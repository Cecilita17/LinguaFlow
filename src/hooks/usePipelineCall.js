import { useState, useRef, useEffect, useCallback } from 'react';
import { getLiveCallPedagogicalCorrection } from '../services/grammarEngine.js';
import { computeWordDiff } from '../services/diffUtils.js';
import {
  tokenizeLiveCallTurn,
  glossLiveCallTurnAsync,
  extractTurnTransliteration,
  extractTurnGlosses
} from '../services/liveCallGlossService.js';
import { transcribeAudioApi } from '../services/chatService.js';
import { cleanDuplicatePhrases } from './useSpeech.js';

/**
 * Configurable post-TTS acoustic echo guard duration (ms).
 * Used strictly as a short guard for the physical room acoustic tail
 * immediately after the speaker stops, without blocking genuine user speech.
 */
const POST_TTS_ECHO_GUARD_MS = 350;

/**
 * Voice Activity Detection (VAD) Configuration
 */
const VAD_INTERVAL_MS = 40;
const SPEECH_ENERGY_THRESHOLD = 14;
const MIN_SPEECH_DURATION_MS = 250;
const SILENCE_TIMEOUT_MS = 900;

/**
 * Hook for managing Low-Cost Live Voice Calls (Pipeline Architecture) in LinguaFlow.
 * Flow:
 * - Single persistent MediaStream with Web Audio Voice Activity Detection (VAD)
 * - Multilingual Speech-to-Text via Groq Whisper (/api/transcribe) preserving code-switching
 * - Intelligent Sentence Boundary Chunker (dispatches sentences to TTS as they stream)
 * - Streaming TTS Synthesis (/api/pipeline/tts Cartesia Sonic-3.6 Audio Queue Player)
 * - Pedagogical sentence-level correction post-turn via grammarEngine
 * - Word-by-word Glosses & Local Transliteration (Arabic/Chinese)
 * - Half-Duplex Acoustic Protection & Post-TTS Echo Guard
 * - Zero hardware microphone conflicts / multi-turn continuous conversation
 */
export function usePipelineCall({
  targetLang = 'es',
  nativeLang = 'es',
  level = 'A2/B1',
  isSpanish = true,
  voice = 'alloy',
  apiKey = ''
}) {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [showGlosses, setShowGlosses] = useState(false);

  const durationTimerRef = useRef(null);
  const liveTranscriptRef = useRef([]);
  const callDurationSecondsRef = useRef(0);
  const showGlossesRef = useRef(false);
  const isMutedRef = useRef(false);
  const callStateRef = useRef('idle');

  // Single-Stream Audio & VAD Refs
  const mediaStreamRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingTurnRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const silenceTimeoutRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const isVadActiveRef = useRef(false);

  const currentTurnRef = useRef({
    id: null,
    confirmedText: '',
    text: '',
    finalized: false
  });

  // Half-Duplex Acoustic Protection & TTS Playback State Refs
  const isSttPausedRef = useRef(false);
  const isLlmStreamingRef = useRef(false);
  const audioContextRef = useRef(null);
  const activeAudioSourceRef = useRef(null);
  const activeAudioElementRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const llmAbortControllerRef = useRef(null);
  const ttsAbortControllerRef = useRef(null);
  const currentAiTurnIdRef = useRef(null);
  const currentAiTurnTextRef = useRef('');
  const lastAiSpokenTextRef = useRef('');
  const lastAiSpokenTimestampRef = useRef(0);
  const isEchoGuardActiveRef = useRef(false);
  const echoGuardTimerRef = useRef(null);

  // Deduplication & Lifecycle Sets
  const correctedTurnIdsRef = useRef(new Set());
  const glossedTurnIdsRef = useRef(new Set());
  const processedUserTurnIdsRef = useRef(new Set());

  // Metrics Tracking
  const sessionMetricsRef = useRef({
    sessionId: null,
    mode: 'pipeline',
    startedAt: null,
    endedAt: null,
    durationSeconds: 0,
    userTurns: 0,
    assistantTurns: 0,
    sttRequests: 0,
    llmRequests: 0,
    ttsRequests: 0,
    correctionRequests: 0,
    correctionSuccesses: 0,
    correctionFailures: 0,
    duplicateCorrectionAttempts: 0,
    transcriptionEvents: 0,
    glossRequests: 0,
    errors: []
  });

  // Sync refs with state
  useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript]);
  useEffect(() => { callDurationSecondsRef.current = callDurationSeconds; }, [callDurationSeconds]);
  useEffect(() => { showGlossesRef.current = showGlosses; }, [showGlosses]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const stopDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const startDurationTimer = () => {
    stopDurationTimer();
    setCallDurationSeconds(0);
    durationTimerRef.current = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
  };

  const formatSeconds = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stop any active audio playback immediately
  const stopAudioPlayback = useCallback(() => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
        activeAudioSourceRef.current.disconnect();
      } catch (e) {}
      activeAudioSourceRef.current = null;
    }

    if (activeAudioElementRef.current) {
      try {
        activeAudioElementRef.current.pause();
        activeAudioElementRef.current.src = '';
      } catch (e) {}
      activeAudioElementRef.current = null;
    }

    ttsQueueRef.current = [];
    isPlayingQueueRef.current = false;
  }, []);

  // Cancel active AI generation & playback (Barge-in / Interruption)
  const interruptAssistant = useCallback(() => {
    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }
    isEchoGuardActiveRef.current = false;
    isLlmStreamingRef.current = false;
    isSttPausedRef.current = false;

    if (llmAbortControllerRef.current) {
      try { llmAbortControllerRef.current.abort(); } catch (e) {}
      llmAbortControllerRef.current = null;
    }

    if (ttsAbortControllerRef.current) {
      try { ttsAbortControllerRef.current.abort(); } catch (e) {}
      ttsAbortControllerRef.current = null;
    }

    stopAudioPlayback();

    // Finalize non-empty streaming AI turn, or completely remove empty AI placeholder
    const currentAiId = currentAiTurnIdRef.current;
    if (currentAiId) {
      setLiveTranscript((prev) =>
        prev
          .map((msg) => (msg.id === currentAiId ? { ...msg, isStreaming: false } : msg))
          .filter((msg) => !(msg.id === currentAiId && (!msg.text || !msg.text.trim())))
      );
      currentAiTurnIdRef.current = null;
      currentAiTurnTextRef.current = '';
    }
  }, [stopAudioPlayback]);

  // Teardown all resources
  const cleanupResources = useCallback(() => {
    stopDurationTimer();

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    isVadActiveRef.current = false;
    isRecordingTurnRef.current = false;

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }
    isEchoGuardActiveRef.current = false;
    isLlmStreamingRef.current = false;
    isSttPausedRef.current = false;
    lastAiSpokenTextRef.current = '';

    interruptAssistant();

    // Stop MediaRecorder if recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }

    // Disconnect MediaStreamSource
    if (mediaStreamSourceRef.current) {
      try {
        mediaStreamSourceRef.current.disconnect();
      } catch (e) {}
      mediaStreamSourceRef.current = null;
    }
    analyserRef.current = null;

    // Release microphone hardware stream
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }

    // Close Web Audio Context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    // Clear deduplication caches & turn state
    correctedTurnIdsRef.current.clear();
    glossedTurnIdsRef.current.clear();
    processedUserTurnIdsRef.current.clear();
    currentTurnRef.current = {
      id: null,
      confirmedText: '',
      text: '',
      finalized: false
    };
  }, [interruptAssistant]);

  // Trigger pedagogical correction asynchronously for a user voice turn
  const triggerCorrection = useCallback((userText, turnId) => {
    if (!userText || !userText.trim()) return;
    const cleanText = userText.trim();
    const dedupeKey = turnId || cleanText;

    if (correctedTurnIdsRef.current.has(dedupeKey)) {
      sessionMetricsRef.current.duplicateCorrectionAttempts++;
      return;
    }
    correctedTurnIdsRef.current.add(dedupeKey);
    sessionMetricsRef.current.correctionRequests++;

    getLiveCallPedagogicalCorrection(cleanText, targetLang, nativeLang, level)
      .then((correction) => {
        sessionMetricsRef.current.correctionSuccesses++;
        if (correction) {
          const corrected = (correction.corrected_text || cleanText).trim();
          const hasDiffWithChanges = Array.isArray(correction.diff_tokens) &&
            correction.diff_tokens.length > 0 &&
            correction.diff_tokens.some((t) => t.changed);

          const diffTokens = hasDiffWithChanges
            ? correction.diff_tokens
            : (corrected.toLowerCase() !== cleanText.toLowerCase()
                ? computeWordDiff(cleanText, corrected)
                : (Array.isArray(correction.diff_tokens) && correction.diff_tokens.length > 0
                    ? correction.diff_tokens
                    : computeWordDiff(cleanText, corrected)));

          const hasErrors = Boolean(
            correction.has_errors ||
            diffTokens.some((t) => t.changed) ||
            corrected.toLowerCase() !== cleanText.toLowerCase()
          );
          const updatedTokens = tokenizeLiveCallTurn(corrected, targetLang, diffTokens);

          setLiveTranscript((prev) => {
            let targetIdx = prev.findIndex((msg) => msg.id === turnId);
            if (targetIdx < 0) {
              targetIdx = prev.findIndex((msg) => msg.sender === 'user' && msg.text === cleanText && msg.isCorrecting);
            }
            if (targetIdx < 0) {
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].sender === 'user' && prev[i].isCorrecting) {
                  targetIdx = i;
                  break;
                }
              }
            }

            if (targetIdx >= 0) {
              const updated = [...prev];
              updated[targetIdx] = {
                ...updated[targetIdx],
                hasCorrection: hasErrors,
                text: corrected,
                correctedText: corrected,
                diffTokens,
                tokens: updatedTokens,
                transliteration: extractTurnTransliteration(updatedTokens, targetLang),
                glosses: extractTurnGlosses(updatedTokens),
                originalText: correction.original_text || cleanText,
                isCorrecting: false
              };
              return updated;
            }
            return prev;
          });

          if (showGlossesRef.current) {
            triggerTurnGloss(turnId, corrected, updatedTokens);
          }
        }
      })
      .catch((err) => {
        sessionMetricsRef.current.correctionFailures++;
        console.warn('[PipelineCorrection] Notice:', err);
        setLiveTranscript((prev) =>
          prev.map((msg) =>
            msg.id === turnId || (msg.sender === 'user' && msg.text === cleanText)
              ? { ...msg, isCorrecting: false }
              : msg
          )
        );
      });
  }, [targetLang, nativeLang, level]);

  // Request AI word-by-word glosses for a transcript turn
  const triggerTurnGloss = useCallback((turnId, turnText, currentTokens = []) => {
    if (!turnText || !turnText.trim() || !turnId) return;
    const cleanText = turnText.trim();

    if (glossedTurnIdsRef.current.has(turnId)) return;
    glossedTurnIdsRef.current.add(turnId);
    sessionMetricsRef.current.glossRequests++;

    setLiveTranscript((prev) =>
      prev.map((msg) => (msg.id === turnId ? { ...msg, isGlossing: true } : msg))
    );

    glossLiveCallTurnAsync({
      turnId,
      text: cleanText,
      tokens: currentTokens,
      targetLang,
      nativeLang
    })
      .then((glossedTokens) => {
        if (Array.isArray(glossedTokens) && glossedTokens.length > 0) {
          setLiveTranscript((prev) =>
            prev.map((msg) =>
              msg.id === turnId
                ? { ...msg, tokens: glossedTokens, isGlossing: false }
                : msg
            )
          );
        } else {
          setLiveTranscript((prev) =>
            prev.map((msg) => (msg.id === turnId ? { ...msg, isGlossing: false } : msg))
          );
        }
      })
      .catch((err) => {
        console.warn('[PipelineGloss] Turn gloss notice:', err);
        setLiveTranscript((prev) =>
          prev.map((msg) => (msg.id === turnId ? { ...msg, isGlossing: false } : msg))
        );
      });
  }, [targetLang, nativeLang]);

  // Process sequential audio chunks in the Web Audio queue
  const playNextInAudioQueue = useCallback(async () => {
    if (isPlayingQueueRef.current || ttsQueueRef.current.length === 0) {
      if (ttsQueueRef.current.length === 0 && !isLlmStreamingRef.current && !isPlayingQueueRef.current) {
        // Activate post-TTS acoustic echo guard to discard room feedback before returning to 'listening'
        if (!isEchoGuardActiveRef.current) {
          isEchoGuardActiveRef.current = true;
          isSttPausedRef.current = true;
          console.log('[PipelineEchoGuard] TTS playback ended -> waiting for acoustic tail');
          lastAiSpokenTimestampRef.current = Date.now();
          if (echoGuardTimerRef.current) {
            clearTimeout(echoGuardTimerRef.current);
          }
          echoGuardTimerRef.current = setTimeout(() => {
            isEchoGuardActiveRef.current = false;
            isSttPausedRef.current = false;
            echoGuardTimerRef.current = null;
            if (callStateRef.current !== 'idle' && callStateRef.current !== 'error') {
              console.log('[PipelineEchoGuard] Listening resumed');
              callStateRef.current = 'listening';
              setCallState('listening');
            }
          }, POST_TTS_ECHO_GUARD_MS);
        }
      }
      return;
    }

    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }
    isEchoGuardActiveRef.current = false;
    isSttPausedRef.current = true;

    const nextItem = ttsQueueRef.current.shift();
    if (!nextItem || !nextItem.text) return;

    isPlayingQueueRef.current = true;
    callStateRef.current = 'speaking';
    setCallState('speaking');

    try {
      console.log('[PipelineTTS] Synthesizing text chunk:', nextItem.text.slice(0, 40) + '...');
      ttsAbortControllerRef.current = new AbortController();
      sessionMetricsRef.current.ttsRequests++;

      const ttsResponse = await fetch('/api/pipeline/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nextItem.text,
          voice,
          targetLang
        }),
        signal: ttsAbortControllerRef.current.signal
      });

      const contentType = ttsResponse.headers.get('content-type') || '';

      if (!ttsResponse.ok) {
        let errBody = '';
        try {
          errBody = await ttsResponse.text();
        } catch (readErr) {
          errBody = readErr.message;
        }
        console.error(`[PipelineTTS] Backend error (HTTP ${ttsResponse.status}):`, errBody);
        throw new Error(`TTS service returned HTTP ${ttsResponse.status}: ${errBody}`);
      }

      // Check for audio/wav, audio/mpeg, or audio/mp3
      if (contentType.includes('audio/wav') || contentType.includes('audio/mpeg') || contentType.includes('audio/mp3') || contentType.includes('audio/webm')) {
        const audioBlob = await ttsResponse.blob();

        if (audioBlob.size === 0) {
          throw new Error('Received 0-byte audio stream from TTS');
        }

        // Play via Web Audio Context if available for lower latency
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try {
            if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
            }
            const arrayBuffer = await audioBlob.arrayBuffer();
            const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(audioContextRef.current.destination);

            activeAudioSourceRef.current = source;

            source.onended = () => {
              activeAudioSourceRef.current = null;
              isPlayingQueueRef.current = false;
              playNextInAudioQueue();
            };

            source.start(0);
          } catch (decodeErr) {
            console.warn('[PipelineTTS] Web Audio decode notice, fallback to HTMLAudio:', decodeErr);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            activeAudioElementRef.current = audio;

            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              activeAudioElementRef.current = null;
              isPlayingQueueRef.current = false;
              playNextInAudioQueue();
            };

            audio.onerror = (e) => {
              console.warn('[PipelineTTS] HTMLAudio error:', e);
              URL.revokeObjectURL(audioUrl);
              activeAudioElementRef.current = null;
              isPlayingQueueRef.current = false;
              playNextInAudioQueue();
            };

            await audio.play();
          }
        } else {
          // Standard HTMLAudioElement playback
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          activeAudioElementRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            activeAudioElementRef.current = null;
            isPlayingQueueRef.current = false;
            playNextInAudioQueue();
          };

          audio.onerror = (e) => {
            console.warn('[PipelineTTS] HTMLAudio error:', e);
            URL.revokeObjectURL(audioUrl);
            activeAudioElementRef.current = null;
            isPlayingQueueRef.current = false;
            playNextInAudioQueue();
          };

          await audio.play();
        }
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[PipelineTTS] Playback notice:', err);
      }
      isPlayingQueueRef.current = false;
      playNextInAudioQueue();
    }
  }, [voice, targetLang]);

  // Enqueue a sentence chunk for TTS synthesis and playback
  const enqueueTextForTTS = useCallback((textChunk) => {
    const clean = (textChunk || '').trim();
    if (!clean) return;

    isSttPausedRef.current = true;
    ttsQueueRef.current.push({ text: clean });
    if (!isPlayingQueueRef.current) {
      playNextInAudioQueue();
    }
  }, [playNextInAudioQueue]);

  // Dispatch streaming LLM conversation request
  const dispatchAssistantResponse = useCallback(async (userPrompt) => {
    if (!userPrompt || !userPrompt.trim()) return;
    const cleanPrompt = userPrompt.trim();

    interruptAssistant();
    isLlmStreamingRef.current = true;
    isSttPausedRef.current = true;
    callStateRef.current = 'thinking';
    setCallState('thinking');

    // Reset currentTurnRef so subsequent user speech starts completely fresh
    currentTurnRef.current = {
      id: null,
      confirmedText: '',
      text: '',
      finalized: false
    };

    const aiTurnId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    currentAiTurnIdRef.current = aiTurnId;
    currentAiTurnTextRef.current = '';

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLiveTranscript((prev) => [
      ...prev,
      {
        id: aiTurnId,
        sender: 'bot',
        speaker: 'LinguaFlow',
        text: '',
        timestamp: timeStr,
        isStreaming: true,
        tokens: []
      }
    ]);

    sessionMetricsRef.current.llmRequests++;

    try {
      llmAbortControllerRef.current = new AbortController();

      const historyPayload = liveTranscriptRef.current
        .filter((msg) => msg.id !== aiTurnId && msg.text && msg.text.trim())
        .slice(-6)
        .map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: (msg.correctedText || msg.text).trim()
        }));

      const streamResponse = await fetch('/api/pipeline/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanPrompt,
          targetLang,
          nativeLang,
          level,
          voice,
          history: historyPayload
        }),
        signal: llmAbortControllerRef.current.signal
      });

      if (!streamResponse.ok) {
        throw new Error(`LLM streaming service error: HTTP ${streamResponse.status}`);
      }

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sentenceBuffer = '';
      const terminalPunctuationRegex = /([.!?。！？]+)/;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split('\n');

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data:')) continue;
          const jsonStr = trimmedLine.replace(/^data:\s*/, '');
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.content || parsed.text || '';
            if (deltaContent) {
              currentAiTurnTextRef.current += deltaContent;
              sentenceBuffer += deltaContent;

              const liveText = currentAiTurnTextRef.current;
              const liveTokens = tokenizeLiveCallTurn(liveText, targetLang);

              setLiveTranscript((prev) =>
                prev.map((msg) =>
                  msg.id === aiTurnId
                    ? { ...msg, text: liveText, tokens: liveTokens }
                    : msg
                )
              );

              // Sentence boundary chunking: dispatch completed sentences directly to TTS
              let match;
              while ((match = terminalPunctuationRegex.exec(sentenceBuffer)) !== null) {
                const punctEnd = match.index + match[0].length;
                const completedSentence = sentenceBuffer.slice(0, punctEnd).trim();
                sentenceBuffer = sentenceBuffer.slice(punctEnd).trim();

                if (completedSentence) {
                  enqueueTextForTTS(completedSentence);
                }
              }
            }
          } catch (e) {}
        }
      }

      // Flush any trailing text in sentenceBuffer
      if (sentenceBuffer.trim()) {
        enqueueTextForTTS(sentenceBuffer.trim());
      }

      // Finalize AI message
      const finalText = currentAiTurnTextRef.current;
      sessionMetricsRef.current.assistantTurns++;
      const finalTokens = tokenizeLiveCallTurn(finalText, targetLang);

      setLiveTranscript((prev) =>
        prev
          .map((msg) =>
            msg.id === aiTurnId
              ? { ...msg, text: finalText, tokens: finalTokens, isStreaming: false }
              : msg
          )
          .filter((msg) => !(msg.id === aiTurnId && (!msg.text || !msg.text.trim())))
      );

      if (showGlossesRef.current && finalText.trim()) {
        triggerTurnGloss(aiTurnId, finalText, finalTokens);
      }

      currentAiTurnIdRef.current = null;
      currentAiTurnTextRef.current = '';
      lastAiSpokenTimestampRef.current = Date.now();

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[PipelineChatStream] Notice:', err);
        sessionMetricsRef.current.errors.push(err.message);
      }
      setLiveTranscript((prev) =>
        prev
          .map((msg) => (msg.id === aiTurnId ? { ...msg, isStreaming: false } : msg))
          .filter((msg) => !(msg.id === aiTurnId && (!msg.text || !msg.text.trim())))
      );
      currentAiTurnIdRef.current = null;
      currentAiTurnTextRef.current = '';
      lastAiSpokenTimestampRef.current = Date.now();
    } finally {
      isLlmStreamingRef.current = false;
      llmAbortControllerRef.current = null;
      if (ttsQueueRef.current.length === 0 && !isPlayingQueueRef.current) {
        playNextInAudioQueue();
      }
    }
  }, [targetLang, nativeLang, level, voice, interruptAssistant, enqueueTextForTTS, triggerTurnGloss, playNextInAudioQueue]);

  // Finalize and process a completed user speech turn
  const finalizeUserSpeechTurn = useCallback((userText, turnId) => {
    if (!userText || !userText.trim()) return;
    const cleanText = cleanDuplicatePhrases(userText.trim());
    if (!cleanText) return;

    const activeTurn = currentTurnRef.current;
    const currentId = turnId || activeTurn.id || `user-${Date.now()}`;

    if (processedUserTurnIdsRef.current.has(currentId)) {
      return;
    }
    processedUserTurnIdsRef.current.add(currentId);
    sessionMetricsRef.current.userTurns++;

    if (activeTurn.id === currentId) {
      activeTurn.finalized = true;
      activeTurn.text = cleanText;
      activeTurn.confirmedText = cleanText;
    }
    currentTurnRef.current = {
      id: null,
      confirmedText: '',
      text: '',
      finalized: false
    };

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initialTokens = tokenizeLiveCallTurn(cleanText, targetLang);
    const initialTranslit = extractTurnTransliteration(initialTokens, targetLang);
    const initialGlosses = extractTurnGlosses(initialTokens);

    setLiveTranscript((prev) => {
      let targetIdx = prev.findIndex((m) => m.id === currentId);
      if (targetIdx < 0) {
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].sender === 'user' && prev[i].isTranscribing) {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx >= 0) {
        const updated = [...prev];
        updated[targetIdx] = {
          ...updated[targetIdx],
          id: currentId,
          text: cleanText,
          originalText: cleanText,
          correctedText: cleanText,
          diffTokens: [{ text: cleanText, changed: false, original: null }],
          tokens: initialTokens,
          transliteration: initialTranslit,
          glosses: initialGlosses,
          isTranscribing: false,
          isCorrecting: true
        };
        return updated;
      }

      const newUserMsg = {
        id: currentId,
        sender: 'user',
        speaker: isSpanish ? 'Tú' : 'You',
        text: cleanText,
        timestamp: timeStr,
        hasCorrection: false,
        diffTokens: [{ text: cleanText, changed: false, original: null }],
        tokens: initialTokens,
        transliteration: initialTranslit,
        glosses: initialGlosses,
        originalText: cleanText,
        correctedText: cleanText,
        isCorrecting: true,
        isTranscribing: false
      };
      return [...prev, newUserMsg];
    });

    // Asynchronously trigger pedagogical correction
    triggerCorrection(cleanText, currentId);

    // Dispatch assistant conversational response
    dispatchAssistantResponse(cleanText);
  }, [targetLang, isSpanish, triggerCorrection, dispatchAssistantResponse]);

  // Start capturing audio for a new user turn
  const startTurnAudioRecording = useCallback(() => {
    if (!mediaStreamRef.current || isRecordingTurnRef.current) return;
    if (isSttPausedRef.current || isMutedRef.current || isEchoGuardActiveRef.current) return;

    isRecordingTurnRef.current = true;
    speechStartTimeRef.current = Date.now();
    audioChunksRef.current = [];

    const turnId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    currentTurnRef.current = {
      id: turnId,
      confirmedText: '',
      text: '',
      finalized: false
    };

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLiveTranscript((prev) => [
      ...prev,
      {
        id: turnId,
        sender: 'user',
        speaker: isSpanish ? 'Tú' : 'You',
        text: '',
        isTranscribing: true,
        timestamp: timeStr
      }
    ]);

    try {
      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
        }
        const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        console.log('[PipelineVAD] MediaRecorder started for user turn:', turnId);
      }
    } catch (err) {
      console.warn('[PipelineVAD] MediaRecorder start notice:', err);
    }
  }, [isSpanish]);

  // Stop recording user turn and transcribe via Groq Whisper Multilingual API
  const stopTurnAudioRecordingAndTranscribe = useCallback(async () => {
    if (!isRecordingTurnRef.current) return;
    isRecordingTurnRef.current = false;

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    const activeTurn = currentTurnRef.current;
    const turnId = activeTurn?.id;
    const speechDuration = Date.now() - (speechStartTimeRef.current || Date.now());

    let audioBlob = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        const stopPromise = new Promise((resolve) => {
          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(audioChunksRef.current, {
              type: mediaRecorderRef.current.mimeType || 'audio/webm'
            });
            resolve(blob);
          };
          mediaRecorderRef.current.stop();
        });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          resolve(blob);
        }, 500));
        audioBlob = await Promise.race([stopPromise, timeoutPromise]);
      } catch (err) {
        console.warn('[PipelineVAD] Error stopping MediaRecorder:', err);
      }
      mediaRecorderRef.current = null;
    } else if (audioChunksRef.current.length > 0) {
      audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    // Ignore short audio spikes / clicks (< 250ms or < 300 bytes)
    if (!audioBlob || audioBlob.size < 300 || speechDuration < MIN_SPEECH_DURATION_MS) {
      console.log('[PipelineVAD] Discarding noise spike (<250ms)');
      setLiveTranscript((prev) => prev.filter((m) => m.id !== turnId));
      currentTurnRef.current = { id: null, confirmedText: '', text: '', finalized: false };
      return;
    }

    console.log(`[PipelineVAD] User turn audio captured (${audioBlob.size} bytes, ${speechDuration}ms). Transcribing via Groq Whisper...`);
    sessionMetricsRef.current.sttRequests++;

    try {
      const transcript = await transcribeAudioApi({
        audioBlob,
        targetLang,
        nativeLang,
        apiKey
      });

      if (transcript && transcript.trim()) {
        const cleanTranscript = cleanDuplicatePhrases(transcript.trim());
        console.log('✅ [PipelineVAD] Groq Whisper Transcribed:', cleanTranscript);
        finalizeUserSpeechTurn(cleanTranscript, turnId);
      } else {
        console.log('[PipelineVAD] Groq Whisper returned empty transcript');
        setLiveTranscript((prev) => prev.filter((m) => m.id !== turnId));
        currentTurnRef.current = { id: null, confirmedText: '', text: '', finalized: false };
      }
    } catch (err) {
      console.error('[PipelineVAD] Transcribe error:', err);
      setLiveTranscript((prev) => prev.filter((m) => m.id !== turnId));
      currentTurnRef.current = { id: null, confirmedText: '', text: '', finalized: false };
    }
  }, [targetLang, nativeLang, apiKey, finalizeUserSpeechTurn]);

  // Real-time Voice Activity Detection monitoring loop
  const checkVadAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isVadActiveRef.current) return;
    if (isSttPausedRef.current || isMutedRef.current || isEchoGuardActiveRef.current) return;

    const isSpeakingState = callStateRef.current === 'speaking' || callStateRef.current === 'thinking';
    const isPlaybackActive = isPlayingQueueRef.current || Boolean(activeAudioSourceRef.current) || Boolean(activeAudioElementRef.current);
    const isQueueActive = ttsQueueRef.current.length > 0;
    const isLlmActive = isLlmStreamingRef.current || Boolean(currentAiTurnIdRef.current);

    if (isSpeakingState || isPlaybackActive || isQueueActive || isLlmActive) {
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avgEnergy = sum / dataArray.length;

    // Speech detected
    if (avgEnergy >= SPEECH_ENERGY_THRESHOLD) {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (!isRecordingTurnRef.current) {
        startTurnAudioRecording();
      }
    } else {
      // Volume below threshold
      if (isRecordingTurnRef.current) {
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            stopTurnAudioRecordingAndTranscribe();
          }, SILENCE_TIMEOUT_MS);
        }
      }
    }
  }, [startTurnAudioRecording, stopTurnAudioRecordingAndTranscribe]);

  // Start Pipeline Call
  const startCall = useCallback(async () => {
    // 1. Initialize AudioContext on user gesture
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
        console.log('[PipelineAudio] AudioContext created');
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch((err) => {
          console.warn('[PipelineAudio] AudioContext resume notice:', err);
        });
      }
    } catch (audioInitErr) {
      console.warn('[PipelineAudio] AudioContext initialization notice:', audioInitErr);
    }

    try {
      // Clear previous resources
      stopDurationTimer();
      interruptAssistant();

      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      correctedTurnIdsRef.current.clear();
      glossedTurnIdsRef.current.clear();
      processedUserTurnIdsRef.current.clear();
      currentTurnRef.current = {
        id: null,
        confirmedText: '',
        text: '',
        finalized: false
      };

      setCallState('connecting');
      setErrorMessage(null);
      setLiveTranscript([]);
      setIsMuted(false);

      // Initialize session metrics
      const newSessionId = `call-pipeline-${Date.now()}`;
      sessionMetricsRef.current = {
        sessionId: newSessionId,
        mode: 'pipeline',
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationSeconds: 0,
        userTurns: 0,
        assistantTurns: 0,
        sttRequests: 0,
        llmRequests: 0,
        ttsRequests: 0,
        correctionRequests: 0,
        correctionSuccesses: 0,
        correctionFailures: 0,
        duplicateCorrectionAttempts: 0,
        transcriptionEvents: 0,
        glossRequests: 0,
        errors: []
      };

      // 2. Request microphone stream (single persistent stream for VAD & audio capture)
      let stream = null;
      try {
        console.log('[PipelineMic] Requesting microphone access...');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        mediaStreamRef.current = stream;
        console.log('[PipelineMic] Microphone stream opened successfully.');
      } catch (micErr) {
        console.error('[PipelineMic] Microphone permission error:', micErr);
        throw new Error(
          isSpanish
            ? 'No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.'
            : 'Microphone access denied. Please grant microphone permissions in your browser.'
        );
      }

      // 3. Connect single stream to AnalyserNode for real-time VAD
      if (audioContextRef.current && stream) {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        const source = audioContextRef.current.createMediaStreamSource(stream);
        mediaStreamSourceRef.current = source;
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        analyserRef.current = analyser;
      }

      // 4. Start VAD monitoring loop
      isVadActiveRef.current = true;
      isSttPausedRef.current = false;
      callStateRef.current = 'listening';
      setCallState('listening');

      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = setInterval(checkVadAudioLevel, VAD_INTERVAL_MS);

      startDurationTimer();

    } catch (err) {
      console.error('❌ Error in startPipelineCall:', err);
      cleanupResources();
      setCallState('error');
      setErrorMessage(err.message || 'Error desconocido al conectar la llamada.');
    }
  }, [isSpanish, cleanupResources, interruptAssistant, checkVadAudioLevel]);

  // Toggle Mute / Unmute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      if (next) {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (isRecordingTurnRef.current) {
          isRecordingTurnRef.current = false;
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try { mediaRecorderRef.current.stop(); } catch (e) {}
          }
          const turnId = currentTurnRef.current?.id;
          if (turnId) {
            setLiveTranscript((p) => p.filter((m) => m.id !== turnId));
          }
        }
      }
      return next;
    });
  }, []);

  // End Pipeline Call: teardown and return session record
  const endCall = useCallback(() => {
    const finalSeconds = callDurationSecondsRef.current;
    const finalTranscript = [...liveTranscriptRef.current];

    sessionMetricsRef.current.endedAt = new Date().toISOString();
    sessionMetricsRef.current.durationSeconds = finalSeconds;
    const finalMetrics = { ...sessionMetricsRef.current };

    cleanupResources();
    setCallState('idle');

    const formattedDuration = formatSeconds(finalSeconds);
    const firstUserMsg = finalTranscript.find((m) => m.sender === 'user')?.text;
    const firstBotMsg = finalTranscript.find((m) => m.sender === 'bot')?.text;

    const summaryText = firstUserMsg
      ? (firstUserMsg.length > 55 ? `${firstUserMsg.slice(0, 52)}...` : firstUserMsg)
      : (firstBotMsg
          ? (firstBotMsg.length > 55 ? `${firstBotMsg.slice(0, 52)}...` : firstBotMsg)
          : (isSpanish ? 'Llamada de voz (Modo Económico)' : 'Voice Call (Cost-Efficient)'));

    const sessionRecord = {
      id: `call-pipeline-${Date.now()}`,
      type: 'call',
      mode: 'pipeline',
      lang: targetLang,
      date: isSpanish ? 'Hoy' : 'Today',
      timestamp: Date.now(),
      duration: formattedDuration,
      summary: summaryText,
      metrics: finalMetrics,
      transcript: finalTranscript.map((msg) => {
        const tokens = Array.isArray(msg.tokens) ? msg.tokens : [];
        const transliteration = msg.transliteration || extractTurnTransliteration(tokens, targetLang);
        const glosses = msg.glosses || extractTurnGlosses(tokens);
        return {
          ...msg,
          tokens,
          transliteration,
          glosses
        };
      })
    };

    return sessionRecord;
  }, [targetLang, isSpanish, cleanupResources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    callState,
    isMuted,
    errorMessage,
    liveTranscript,
    showGlosses,
    setShowGlosses,
    toggleGlosses: () => setShowGlosses((prev) => !prev),
    callDurationSeconds,
    formattedDuration: formatSeconds(callDurationSeconds),
    startCall,
    endCall,
    toggleMute
  };
}

export default usePipelineCall;
