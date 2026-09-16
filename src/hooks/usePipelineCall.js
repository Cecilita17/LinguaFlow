import { useState, useRef, useEffect, useCallback } from 'react';
import { getLiveCallPedagogicalCorrection } from '../services/grammarEngine.js';
import {
  tokenizeLiveCallTurn,
  glossLiveCallTurnAsync,
  extractTurnTransliteration,
  extractTurnGlosses
} from '../services/liveCallGlossService.js';
import { isGlossComplete } from '../services/subtitleGlossService.js';
import { cleanDuplicatePhrases } from './useSpeech.js';

/**
 * Deterministically merges newly recognized turn text with existing confirmed text,
 * handling full prefix re-emissions and boundary word overlaps gracefully.
 */
function mergeTurnText(confirmed, incoming) {
  if (!confirmed) return incoming || '';
  if (!incoming) return confirmed || '';
  const conf = confirmed.trim();
  const inc = incoming.trim();
  if (!conf) return inc;
  if (!inc) return conf;

  // If incoming already includes confirmed as prefix, use incoming
  if (inc.toLowerCase().startsWith(conf.toLowerCase())) {
    return inc;
  }
  // If confirmed already includes incoming as suffix, use confirmed
  if (conf.toLowerCase().endsWith(inc.toLowerCase())) {
    return conf;
  }

  // Check for word-level overlap at boundary (suffix of conf matching prefix of inc)
  const confWords = conf.split(/\s+/);
  const incWords = inc.split(/\s+/);
  const maxOverlap = Math.min(confWords.length, incWords.length);
  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const confSuffix = confWords.slice(-overlap).join(' ').toLowerCase();
    const incPrefix = incWords.slice(0, overlap).join(' ').toLowerCase();
    if (confSuffix === incPrefix) {
      return `${conf} ${incWords.slice(overlap).join(' ')}`.trim();
    }
  }

  return `${conf} ${inc}`.trim();
}

/**
 * Configurable post-TTS acoustic echo guard duration (ms).
 * Used strictly as a short guard for the physical room acoustic tail
 * immediately after the speaker stops, without blocking genuine user speech.
 */
const POST_TTS_ECHO_GUARD_MS = 250;

/**
 * Conservative acoustic echo fallback detector.
 * Only flags unmistakable verbatim or consecutive reproduction of what the AI just spoke,
 * never penalizing legitimate user responses that merely share vocabulary words.
 */
function isLikelyEcho(transcript, aiText) {
  if (!transcript || !aiText) return false;
  const cleanTrans = transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"¡¿]/g, '')
    .trim();
  const cleanAi = aiText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"¡¿]/g, '')
    .trim();
  if (!cleanTrans || !cleanAi) return false;

  // 1. Direct exact full-phrase match
  if (cleanTrans === cleanAi) return true;

  // 2. Exact consecutive substring match for substantial phrases (>= 3 words)
  const transWords = cleanTrans.split(/\s+/).filter(Boolean);
  if (transWords.length >= 3 && cleanAi.includes(cleanTrans)) {
    return true;
  }

  // 3. For short utterances (1-2 words), only consider echo if AI utterance is identical
  if (transWords.length < 3) {
    return cleanAi === cleanTrans;
  }

  return false;
}

/**
 * Hook for managing Low-Cost Live Voice Calls (Pipeline Architecture) in LinguaFlow.
 * Flow:
 * - Client Microphone + Live STT (Streaming Speech Recognition + Auto-VAD)
 * - Intelligent Sentence Boundary Chunker (dispatches sentences to TTS as they stream)
 * - Streaming TTS Synthesis (/api/pipeline/tts Cartesia Sonic-3.6 Audio Queue Player)
 * - Pedagogical sentence-level correction post-turn via grammarEngine
 * - Natural Barge-in / Interruption handling
 * - Word-by-word Glosses & Local Transliteration (Arabic/Chinese)
 * - Deduplicated Pedagogical Grammar Corrections
 * - Comprehensive Usage & Latency Metrics Instrumentation
 */
export function usePipelineCall({
  targetLang = 'es',
  nativeLang = 'es',
  level = 'A2/B1',
  isSpanish = true,
  voice = 'alloy'
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

  // Speech Recognition & VAD Refs
  const recognitionRef = useRef(null);
  const isRecognitionActiveRef = useRef(false);
  const silenceTimeoutRef = useRef(null);
  const consumedFinalIndicesRef = useRef(new Set());
  const currentTurnRef = useRef({
    id: null,
    confirmedText: '',
    text: '',
    finalized: false
  });

  // Audio Playback & Streaming Queue Refs
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
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }
    isEchoGuardActiveRef.current = false;
    lastAiSpokenTextRef.current = '';

    interruptAssistant();

    // Stop Speech Recognition
    if (recognitionRef.current) {
      isRecognitionActiveRef.current = false;
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    // Close Web Audio Context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    // Clear deduplication caches & turn state
    consumedFinalIndicesRef.current.clear();
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
          const hasErrors = Boolean(correction.has_errors || correction.diff_tokens?.some((t) => t.changed));
          const corrected = correction.corrected_text || cleanText;
          const diffTokens = correction.diff_tokens && correction.diff_tokens.length > 0
            ? correction.diff_tokens
            : [{ text: cleanText, changed: false, original: null }];
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
      if (ttsQueueRef.current.length === 0 && !currentAiTurnIdRef.current) {
        // Activate post-TTS acoustic echo guard to discard room feedback before returning to 'listening'
        if (!isEchoGuardActiveRef.current && !isPlayingQueueRef.current) {
          isEchoGuardActiveRef.current = true;
          lastAiSpokenTimestampRef.current = Date.now();
          if (echoGuardTimerRef.current) {
            clearTimeout(echoGuardTimerRef.current);
          }
          echoGuardTimerRef.current = setTimeout(() => {
            isEchoGuardActiveRef.current = false;
            echoGuardTimerRef.current = null;
            if (callStateRef.current !== 'idle' && callStateRef.current !== 'error') {
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

    const nextItem = ttsQueueRef.current.shift();
    if (!nextItem || !nextItem.text) return;

    isPlayingQueueRef.current = true;
    setCallState('speaking');

    try {
      console.log('[PipelineTTS] Request: synthesising text chunk:', nextItem.text.slice(0, 40) + '...');
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

      console.log('[PipelineTTS] Response status:', ttsResponse.status);
      const contentType = ttsResponse.headers.get('content-type') || '';
      console.log('[PipelineTTS] Content-Type:', contentType);

      if (!ttsResponse.ok) {
        const errBody = await ttsResponse.text();
        // Parse structured error from backend for better diagnostics
        let errInfo = errBody;
        try { errInfo = JSON.parse(errBody); } catch (_) {}
        console.warn(
          '[PipelineTTS] ⚠ TTS FAILED. HTTP', ttsResponse.status,
          '| upstream:', errInfo?.upstream || 'unknown',
          '| details:', errInfo?.details || errBody
        );
        isPlayingQueueRef.current = false;
        playNextInAudioQueue();
        return;
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      console.log('[PipelineTTS] Audio bytes:', audioBuffer ? audioBuffer.byteLength : 0);

      if (!audioBuffer || audioBuffer.byteLength === 0) {
        console.warn('[PipelineTTS] Playback failed: TTS returned 0 audio bytes');
        isPlayingQueueRef.current = false;
        playNextInAudioQueue();
        return;
      }

      // 1. Try Web Audio API playback
      let webAudioStarted = false;
      const ctx = audioContextRef.current;

      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          if (ctx.state === 'running') {
            // Use a slice of the ArrayBuffer so decode failure does not detach the buffer
            const decodedBuffer = await ctx.decodeAudioData(audioBuffer.slice(0));
            if (decodedBuffer) {
              console.log('[PipelineAudio] decodeAudioData success');
              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = decodedBuffer;
              sourceNode.connect(ctx.destination);
              activeAudioSourceRef.current = sourceNode;

              sourceNode.onended = () => {
                console.log('[PipelineAudio] playback ended (Web Audio)');
                activeAudioSourceRef.current = null;
                isPlayingQueueRef.current = false;
                playNextInAudioQueue();
              };

              sourceNode.start(0);
              webAudioStarted = true;
            }
          }
        } catch (webAudioErr) {
          console.warn('[PipelineAudio] decodeAudioData failed, falling back to HTML5 Audio:', webAudioErr);
        }
      }

      // 2. Fallback to HTML5 Audio Element if Web Audio was unavailable or failed
      if (!webAudioStarted) {
        console.log('[PipelineAudio] HTML5 fallback');
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.src = audioUrl;
        audio.preload = 'auto';
        activeAudioElementRef.current = audio;

        audio.onended = () => {
          console.log('[PipelineAudio] playback ended (HTML5 Audio)');
          URL.revokeObjectURL(audioUrl);
          activeAudioElementRef.current = null;
          isPlayingQueueRef.current = false;
          playNextInAudioQueue();
        };

        audio.onerror = (e) => {
          const code = audio.error?.code;
          const message = audio.error?.message;
          console.warn('[PipelineAudio] audio.play failed / HTML5 error:', { code, message, errorEvent: e });
          URL.revokeObjectURL(audioUrl);
          activeAudioElementRef.current = null;
          isPlayingQueueRef.current = false;
          playNextInAudioQueue();
        };

        try {
          await audio.play();
          console.log('[PipelineAudio] audio.play success');
        } catch (playErr) {
          console.warn('[PipelineAudio] audio.play failed:', {
            name: playErr.name,
            message: playErr.message,
            code: audio.error?.code,
            mediaErrorMessage: audio.error?.message
          });
          URL.revokeObjectURL(audioUrl);
          activeAudioElementRef.current = null;
          isPlayingQueueRef.current = false;
          playNextInAudioQueue();
        }
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[PipelineTTS] Playback failed: Request or playback error:', err);
      }
      isPlayingQueueRef.current = false;
      playNextInAudioQueue();
    }
  }, [voice, targetLang]);

  // Enqueue a sentence chunk for TTS synthesis and playback
  const enqueueTextForTTS = useCallback((textChunk) => {
    const clean = (textChunk || '').trim();
    if (!clean) return;

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

    // Insert placeholder bot message into transcript
    setLiveTranscript((prev) => [
      ...prev,
      {
        id: aiTurnId,
        sender: 'bot',
        speaker: 'LinguaFlow AI',
        text: '',
        tokens: [],
        isStreaming: true,
        timestamp: timeStr
      }
    ]);

    llmAbortControllerRef.current = new AbortController();
    sessionMetricsRef.current.llmRequests++;

    try {
      const historyContext = liveTranscriptRef.current
        .filter(m => m.text && !m.isStreaming && m.id !== aiTurnId)
        .slice(-6)
        .map(m => ({ sender: m.sender, text: m.text }));

      const response = await fetch('/api/pipeline/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanPrompt,
          history: historyContext,
          targetLang,
          nativeLang,
          level
        }),
        signal: llmAbortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('LLM Stream status: ' + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let sentenceBuffer = '';

      // Sentence boundary detection regex: punctuation [.!?؛:\n]
      const sentenceRegex = /([^.!?؛:\n]+[.!?؛:\n]+)/g;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.done) {
              break;
            }
            if (data.delta) {
              currentAiTurnTextRef.current += data.delta;
              lastAiSpokenTextRef.current = currentAiTurnTextRef.current;
              lastAiSpokenTimestampRef.current = Date.now();
              sentenceBuffer += data.delta;

              const fullText = currentAiTurnTextRef.current;
              const streamingTokens = tokenizeLiveCallTurn(fullText, targetLang);

              setLiveTranscript((prev) =>
                prev.map((msg) =>
                  msg.id === aiTurnId
                    ? { ...msg, text: fullText, tokens: streamingTokens, isStreaming: true }
                    : msg
                )
              );

              // Check for complete sentence chunk
              sentenceRegex.lastIndex = 0;
              let match;
              let lastIndex = 0;
              while ((match = sentenceRegex.exec(sentenceBuffer)) !== null) {
                const completeSentence = match[1].trim();
                if (completeSentence) {
                  enqueueTextForTTS(completeSentence);
                }
                lastIndex = sentenceRegex.lastIndex;
              }
              if (lastIndex > 0) {
                sentenceBuffer = sentenceBuffer.slice(lastIndex);
                sentenceRegex.lastIndex = 0;
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
    }
  }, [targetLang, nativeLang, level, interruptAssistant, enqueueTextForTTS, triggerTurnGloss]);

  // Finalize and process a completed user speech turn
  const finalizeUserSpeechTurn = useCallback((userText, turnId) => {
    if (!userText || !userText.trim()) return;
    const cleanText = userText.trim();
    if (!cleanText) return;

    const activeTurn = currentTurnRef.current;
    const currentId = turnId || activeTurn.id || `user-${Date.now()}`;

    // 1. Guard against duplicate finalization
    if (activeTurn.id === currentId && activeTurn.finalized) {
      return;
    }
    if (processedUserTurnIdsRef.current.has(currentId)) {
      return;
    }
    processedUserTurnIdsRef.current.add(currentId);
    sessionMetricsRef.current.userTurns++;

    // 2. Mark active turn as finalized and reset currentTurnRef for the next turn
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
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

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

    // Asynchronously trigger single pedagogical correction
    triggerCorrection(cleanText, currentId);

    // Dispatch assistant conversational response
    dispatchAssistantResponse(cleanText);
  }, [targetLang, isSpanish, triggerCorrection, dispatchAssistantResponse]);

  // Initialize Speech Recognition for Live VAD & Streaming STT
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[PipelineSTT] SpeechRecognition not supported in browser');
      return;
    }

    console.log('[PipelineSTT] Creating SpeechRecognition instance for language:', targetLang);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = targetLang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[PipelineSTT] SpeechRecognition onstart fired - actively listening to microphone');
    };

    recognition.onresult = (event) => {
      console.log('[PipelineSTT] SpeechRecognition onresult received event, count:', event.results?.length);
      if (isMutedRef.current) return;

      // 1. Post-TTS Echo Guard: Discard trailing speaker feedback immediately following AI speech
      if (isEchoGuardActiveRef.current) {
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            consumedFinalIndicesRef.current.add(i);
          }
        }
        return;
      }

      // 2. Extract strictly NEW speech from changed results in this event
      let newIncomingSpeech = '';
      const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
      for (let i = startIndex; i < event.results.length; i++) {
        if (!consumedFinalIndicesRef.current.has(i)) {
          const t = event.results[i][0]?.transcript?.trim() || '';
          if (t) {
            newIncomingSpeech = (newIncomingSpeech ? newIncomingSpeech + ' ' : '') + t;
          }
        }
      }
      newIncomingSpeech = newIncomingSpeech.trim();

      // If no new unconsumed speech was detected in changed results, nothing to process
      if (!newIncomingSpeech) return;

      // 3. Active AI Playback / Generation / Recent Spoken Echo Check
      const isAiSpeaking = isPlayingQueueRef.current || Boolean(activeAudioSourceRef.current) || Boolean(activeAudioElementRef.current) || callStateRef.current === 'speaking';
      const isAiGenerating = Boolean(llmAbortControllerRef.current) || Boolean(currentAiTurnIdRef.current) || callStateRef.current === 'thinking';
      const isRecentAiSpeech = (Date.now() - lastAiSpokenTimestampRef.current) < (POST_TTS_ECHO_GUARD_MS + 1000);
      const aiSpokenText = (currentAiTurnTextRef.current || lastAiSpokenTextRef.current || '').trim();

      if (isAiSpeaking || isAiGenerating || isRecentAiSpeech) {
        if (isLikelyEcho(newIncomingSpeech, aiSpokenText)) {
          // Acoustic echo from speaker: consume all final results so far, ignore completely
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              consumedFinalIndicesRef.current.add(i);
            }
          }
          return;
        }

        // If AI is currently speaking/generating and user speaks genuine words (>= 2 chars not matching echo) -> BARGE-IN!
        if (isAiSpeaking || isAiGenerating) {
          const cleanSpeech = newIncomingSpeech.replace(/[.,/#!$%^&*;:{}=\-_`~()?'"¡¿]/g, '').trim();
          if (cleanSpeech.length >= 2) {
            console.log('[PipelineSTT] Genuine user barge-in detected:', newIncomingSpeech);
            interruptAssistant();

            if (echoGuardTimerRef.current) {
              clearTimeout(echoGuardTimerRef.current);
              echoGuardTimerRef.current = null;
            }
            isEchoGuardActiveRef.current = false;

            // Mark all prior finalized results before this event as consumed to isolate new turn
            for (let i = 0; i < startIndex; i++) {
              if (event.results[i].isFinal) {
                consumedFinalIndicesRef.current.add(i);
              }
            }

            // Explicitly reset currentTurnRef so the new turn starts completely fresh without previous text
            currentTurnRef.current = {
              id: null,
              confirmedText: '',
              text: '',
              finalized: false
            };

            setCallState('listening');
          } else {
            // Short breath/click noise while AI speaking -> ignore
            return;
          }
        }
      }

      sessionMetricsRef.current.transcriptionEvents++;

      // 4. Ensure active unfinalized turn state (isolated fresh user turn)
      if (!currentTurnRef.current.id || currentTurnRef.current.finalized) {
        currentTurnRef.current = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          confirmedText: '',
          text: '',
          finalized: false
        };
      }

      const activeTurn = currentTurnRef.current;
      const turnId = activeTurn.id;

      // 5. Process event results: consume unconsumed final items, compute latest unconsumed interim
      let sessionInterim = '';
      for (let i = 0; i < event.results.length; i++) {
        const resultItem = event.results[i];
        const transcript = resultItem[0]?.transcript?.trim() || '';
        if (!transcript) continue;

        if (resultItem.isFinal) {
          if (!consumedFinalIndicesRef.current.has(i)) {
            consumedFinalIndicesRef.current.add(i);
            activeTurn.confirmedText = mergeTurnText(activeTurn.confirmedText, transcript);
          }
        } else {
          if (!consumedFinalIndicesRef.current.has(i)) {
            sessionInterim = (sessionInterim ? sessionInterim + ' ' : '') + transcript;
          }
        }
      }

      sessionInterim = sessionInterim.trim();

      // Full active turn text is confirmed base merged with current interim
      let fullTurnText = activeTurn.confirmedText;
      if (sessionInterim) {
        fullTurnText = mergeTurnText(activeTurn.confirmedText, sessionInterim);
      }
      fullTurnText = fullTurnText.trim();

      activeTurn.text = fullTurnText;
      if (!fullTurnText) return;

      const previewTokens = tokenizeLiveCallTurn(fullTurnText, targetLang);

      setLiveTranscript((prev) => {
        // 1. Find active user bubble by ID
        const existingIdx = prev.findIndex((m) => m.id === turnId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            text: fullTurnText,
            tokens: previewTokens,
            isTranscribing: true
          };
          return updated;
        }

        // 2. Reuse trailing transcribing user bubble ONLY if it matches the current turn ID
        const lastIdx = prev.length - 1;
        if (lastIdx >= 0 && prev[lastIdx].sender === 'user' && prev[lastIdx].id === turnId && prev[lastIdx].isTranscribing) {
          const updated = [...prev];
          updated[lastIdx] = {
            ...updated[lastIdx],
            text: fullTurnText,
            tokens: previewTokens,
            isTranscribing: true
          };
          return updated;
        }

        // 3. Otherwise add new user bubble
        return [
          ...prev,
          {
            id: turnId,
            sender: 'user',
            speaker: isSpanish ? 'Tú' : 'You',
            text: fullTurnText,
            tokens: previewTokens,
            isTranscribing: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });

      // Reset auto-VAD silence timer
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Auto-finalize turn ONLY after stable silence (950ms)
      const capturedTurnId = turnId;
      silenceTimeoutRef.current = setTimeout(() => {
        if (currentTurnRef.current.id === capturedTurnId && !currentTurnRef.current.finalized) {
          const textToFinalize = currentTurnRef.current.text || fullTurnText;
          if (textToFinalize && textToFinalize.trim()) {
            finalizeUserSpeechTurn(textToFinalize.trim(), capturedTurnId);
          }
        }
      }, 950);
    };

    recognition.onerror = (event) => {
      console.warn('[PipelineSTT] SpeechRecognition onerror:', event.error, event.message || '');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setCallState('error');
        setErrorMessage(
          isSpanish
            ? 'Permiso de micrófono denegado para el reconocimiento de voz.'
            : 'Microphone permission denied for speech recognition.'
        );
      } else if (event.error === 'audio-capture') {
        setCallState('error');
        setErrorMessage(
          isSpanish
            ? 'No se detectó ningún micrófono o está bloqueado por otra aplicación.'
            : 'No microphone was found or microphone is busy.'
        );
      }
    };

    recognition.onend = () => {
      console.log('[PipelineSTT] SpeechRecognition onend fired');
      // In a new recognition session, event.results indices start from 0 again
      consumedFinalIndicesRef.current.clear();

      // Auto-restart recognition if call is still active
      if (isRecognitionActiveRef.current) {
        try {
          console.log('[PipelineSTT] Auto-restarting SpeechRecognition...');
          recognition.start();
          console.log('[PipelineSTT] SpeechRecognition restart initiated');
        } catch (e) {
          console.warn('[PipelineSTT] Auto-restart notice:', e);
        }
      }
    };

    recognitionRef.current = recognition;
  }, [targetLang, isSpanish, interruptAssistant, finalizeUserSpeechTurn]);

  // Start Pipeline Call
  const startCall = useCallback(async () => {
    // 1. Immediately create / resume AudioContext synchronously in direct response to user gesture BEFORE any await!
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
        console.log('[PipelineAudio] AudioContext created');
      }
      if (audioContextRef.current) {
        console.log('[PipelineAudio] AudioContext state:', audioContextRef.current.state);
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().then(() => {
            console.log('[PipelineAudio] AudioContext resumed');
          }).catch((err) => {
            console.warn('[PipelineAudio] AudioContext resume notice:', err);
          });
        }
      }
    } catch (audioInitErr) {
      console.warn('[PipelineAudio] AudioContext initialization notice:', audioInitErr);
    }

    try {
      // Clear previous resources without closing the newly unlocked AudioContext
      stopDurationTimer();
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      interruptAssistant();
      if (recognitionRef.current) {
        isRecognitionActiveRef.current = false;
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }
      consumedFinalIndicesRef.current.clear();
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

      // 2. Validate SpeechRecognition browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('[PipelineSTT] SpeechRecognition is not supported in this browser.');
        throw new Error(
          isSpanish
            ? 'Tu navegador no soporta reconocimiento de voz (SpeechRecognition). Por favor usa Google Chrome.'
            : 'Your browser does not support SpeechRecognition. Please use Google Chrome.'
        );
      }

      // 3. Request and verify microphone permissions, then immediately release the stream
      try {
        console.log('[PipelineMic] Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        console.log('[PipelineMic] Microphone permission granted; verification stream released successfully.');
      } catch (micErr) {
        console.error('[PipelineMic] Microphone permission error:', micErr);
        throw new Error(
          isSpanish
            ? 'No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.'
            : 'Microphone access denied. Please grant microphone permissions in your browser.'
        );
      }

      // 4. Initialize and start SpeechRecognition
      initSpeechRecognition();
      if (recognitionRef.current) {
        isRecognitionActiveRef.current = true;
        console.log('[PipelineSTT] Starting SpeechRecognition...');
        try {
          recognitionRef.current.start();
          console.log('[PipelineSTT] SpeechRecognition.start() executed successfully');
        } catch (startErr) {
          console.warn('[PipelineSTT] SpeechRecognition.start() notice:', startErr);
        }
      }

      startDurationTimer();
      setCallState('listening');

    } catch (err) {
      console.error('❌ Error in startPipelineCall:', err);
      cleanupResources();
      setCallState('error');
      setErrorMessage(err.message || 'Error desconocido al conectar la llamada.');
    }
  }, [isSpanish, cleanupResources, initSpeechRecognition, interruptAssistant]);

  // Toggle Mute / Unmute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
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
