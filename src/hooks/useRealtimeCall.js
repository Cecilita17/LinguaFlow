import { useState, useRef, useEffect, useCallback } from 'react';
import { getPedagogicalCorrection } from '../services/grammarEngine.js';
import {
  tokenizeLiveCallTurn,
  glossLiveCallTurnAsync,
  extractTurnTransliteration,
  extractTurnGlosses
} from '../services/liveCallGlossService.js';
import { isGlossComplete } from '../services/subtitleGlossService.js';

/**
 * Hook for managing OpenAI Realtime API WebRTC voice calls in LinguaFlow.
 * Handles:
 * - Ephemeral session request through the backend
 * - Local microphone capture and remote audio streaming
 * - Server VAD with natural user interruptions
 * - Live bidirectional transcription
 * - Mute / Unmute audio track control
 * - Clean WebRTC teardown and session summarization
 */
export function useRealtimeCall({
  targetLang = 'es',
  nativeLang = 'es',
  level = 'A2/B1',
  isSpanish = true
}) {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [showGlosses, setShowGlosses] = useState(false);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioElementRef = useRef(null);
  const durationTimerRef = useRef(null);

  const liveTranscriptRef = useRef([]);
  const callDurationSecondsRef = useRef(0);
  const showGlossesRef = useRef(false);
  const currentAiTurnIdRef = useRef(null);
  const currentAiTurnTextRef = useRef('');
  const pendingUserTurnIdRef = useRef(null);

  // Keep refs in sync with state for access inside event handlers
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  useEffect(() => {
    callDurationSecondsRef.current = callDurationSeconds;
  }, [callDurationSeconds]);

  useEffect(() => {
    showGlossesRef.current = showGlosses;
  }, [showGlosses]);

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

  // Teardown WebRTC and hardware audio resources
  const cleanupResources = useCallback(() => {
    stopDurationTimer();

    // 1. Stop local microphone stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      localStreamRef.current = null;
    }

    // 2. Close Data Channel
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {}
      dataChannelRef.current = null;
    }

    // 3. Close RTCPeerConnection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    // 4. Detach and pause audio element
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
      } catch (e) {}
      audioElementRef.current = null;
    }
  }, []);

  // Asynchronously request AI word-by-word glosses for a transcript turn
  const triggerTurnGloss = useCallback((turnId, turnText, currentTokens = []) => {
    if (!turnText || !turnText.trim()) return;
    const cleanText = turnText.trim();

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
        console.warn('[LiveCallGloss] Turn glossing notice:', err);
        setLiveTranscript((prev) =>
          prev.map((msg) => (msg.id === turnId ? { ...msg, isGlossing: false } : msg))
        );
      });
  }, [targetLang, nativeLang]);

  // When showGlosses is toggled ON, asynchronously gloss any completed turns in transcript that lack glosses
  useEffect(() => {
    if (showGlosses) {
      liveTranscriptRef.current.forEach((msg) => {
        if (msg.text && !isGlossComplete(msg, targetLang) && !msg.isGlossing) {
          triggerTurnGloss(msg.id, msg.text, msg.tokens);
        }
      });
    }
  }, [showGlosses, targetLang, triggerTurnGloss]);

  // Trigger pedagogical correction asynchronously for a user voice turn
  const triggerCorrection = useCallback((userText, turnId) => {
    if (!userText || !userText.trim()) return;
    const cleanText = userText.trim();

    getPedagogicalCorrection(cleanText, targetLang, nativeLang, level)
      .then((correction) => {
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
        console.warn('[PedagogicalCorrection] Live transcript error:', err);
        setLiveTranscript((prev) =>
          prev.map((msg) =>
            msg.id === turnId || (msg.sender === 'user' && msg.text === cleanText)
              ? { ...msg, isCorrecting: false }
              : msg
          )
        );
      });
  }, [targetLang, nativeLang, level, triggerTurnGloss]);

  // Process completed or updated user voice transcript
  const processUserTurn = useCallback((userText, turnId) => {
    if (!userText || !userText.trim()) return;
    const cleanText = userText.trim();
    const currentId = turnId || pendingUserTurnIdRef.current || `user-${Date.now()}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initialTokens = tokenizeLiveCallTurn(cleanText, targetLang);
    const initialTranslit = extractTurnTransliteration(initialTokens, targetLang);
    const initialGlosses = extractTurnGlosses(initialTokens);

    setLiveTranscript((prev) => {
      const existingIdx = prev.findIndex(
        (m) => m.id === currentId || m.id === pendingUserTurnIdRef.current || (m.sender === 'user' && !m.text)
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
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

      // Maintain true chronological conversation order: place before active AI turn if one already began
      const botIdx = currentAiTurnIdRef.current ? prev.findIndex((m) => m.id === currentAiTurnIdRef.current) : -1;
      if (botIdx >= 0) {
        return [...prev.slice(0, botIdx), newUserMsg, ...prev.slice(botIdx)];
      }
      return [...prev, newUserMsg];
    });

    triggerCorrection(cleanText, currentId);
  }, [targetLang, isSpanish, triggerCorrection]);

  // Handle incoming OpenAI Realtime Data Channel events
  const handleServerEvent = useCallback((event) => {
    switch (event.type) {
      case 'session.created':
      case 'session.updated': {
        console.log('🎙️ Realtime session status:', event.type, event.session);
        break;
      }

      // User started speaking -> Server VAD detected barge-in/interruption
      case 'input_audio_buffer.speech_started': {
        setCallState('listening');
        // Finalize active AI streaming turn so it locks in history
        const activeAiId = currentAiTurnIdRef.current;
        if (activeAiId) {
          setLiveTranscript((prev) =>
            prev.map((msg) => (msg.id === activeAiId ? { ...msg, isStreaming: false } : msg))
          );
        }
        currentAiTurnTextRef.current = '';
        currentAiTurnIdRef.current = null;
        pendingUserTurnIdRef.current = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
          try {
            dataChannelRef.current.send(JSON.stringify({ type: 'response.cancel' }));
          } catch (e) {}
        }
        break;
      }

      // Conversation item created by server (user voice turn or assistant)
      case 'conversation.item.created': {
        if (event.item?.role === 'user') {
          const itemId = event.item.id;
          if (itemId) {
            pendingUserTurnIdRef.current = itemId;
          }
          const contentTranscript = event.item.content?.[0]?.transcript?.trim();
          if (contentTranscript) {
            processUserTurn(contentTranscript, itemId || pendingUserTurnIdRef.current);
          }
        }
        break;
      }

      // Streaming delta of user audio transcription
      case 'conversation.item.input_audio_transcription.delta': {
        const delta = event.delta || '';
        const itemId = event.item_id || pendingUserTurnIdRef.current;
        if (delta && itemId) {
          setLiveTranscript((prev) => {
            const idx = prev.findIndex((m) => m.id === itemId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                text: (updated[idx].text || '') + delta
              };
              return updated;
            }
            return prev;
          });
        }
        break;
      }

      // User finished speaking and speech was recognized by whisper-1
      case 'conversation.item.input_audio_transcription.completed': {
        const userText = event.transcript ? event.transcript.trim() : '';
        const itemId = event.item_id || pendingUserTurnIdRef.current;
        if (userText) {
          processUserTurn(userText, itemId);
        }
        break;
      }

      // AI response is being planned
      case 'response.created': {
        setCallState('thinking');
        currentAiTurnTextRef.current = '';
        currentAiTurnIdRef.current = null;
        break;
      }

      // AI is actively streaming response audio and transcript deltas
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        setCallState('speaking');
        const delta = event.delta || '';
        if (!delta) break;

        // If this is the first delta of this turn, allocate a unique turn ID
        if (!currentAiTurnIdRef.current) {
          currentAiTurnIdRef.current = event.item_id || `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          currentAiTurnTextRef.current = '';
        }

        currentAiTurnTextRef.current += delta;
        const currentTurnId = currentAiTurnIdRef.current;
        const currentText = currentAiTurnTextRef.current;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const streamingTokens = tokenizeLiveCallTurn(currentText, targetLang);

        setLiveTranscript((prev) => {
          const index = prev.findIndex((item) => item.id === currentTurnId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              text: currentText,
              tokens: streamingTokens,
              isStreaming: true
            };
            return updated;
          } else {
            return [
              ...prev,
              {
                id: currentTurnId,
                sender: 'bot',
                speaker: 'LinguaFlow AI',
                text: currentText,
                tokens: streamingTokens,
                isStreaming: true,
                timestamp: timeStr
              }
            ];
          }
        });
        break;
      }

      // Turn finished: freeze current AI message and release turn ID
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
      case 'response.done': {
        setCallState('listening');
        const finishedId = currentAiTurnIdRef.current;
        const finishedText = currentAiTurnTextRef.current;
        if (finishedId && finishedText) {
          const botFinalTokens = tokenizeLiveCallTurn(finishedText, targetLang);
          setLiveTranscript((prev) =>
            prev.map((msg) =>
              msg.id === finishedId
                ? { ...msg, isStreaming: false, tokens: botFinalTokens }
                : msg
            )
          );
          if (showGlossesRef.current) {
            triggerTurnGloss(finishedId, finishedText, botFinalTokens);
          }
        }
        currentAiTurnTextRef.current = '';
        currentAiTurnIdRef.current = null;
        break;
      }

      case 'error': {
        console.error('❌ OpenAI Realtime Error event:', event.error);
        if (event.error?.message) {
          setErrorMessage(event.error.message);
        }
        break;
      }

      default:
        break;
    }
  }, [processUserTurn, targetLang, triggerTurnGloss]);

  // Start Realtime Call
  const startCall = useCallback(async () => {
    try {
      cleanupResources();
      setCallState('connecting');
      setErrorMessage(null);
      setLiveTranscript([]);
      setIsMuted(false);
      currentAiTurnTextRef.current = '';
      currentAiTurnIdRef.current = null;

      // 1. Request microphone permission
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        localStreamRef.current = localStream;
      } catch (micErr) {
        throw new Error(
          isSpanish
            ? 'No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.'
            : 'Microphone access denied. Please grant microphone permissions in your browser.'
        );
      }

      // 2. Request ephemeral token from LinguaFlow backend
      const sessionResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLang,
          nativeLang,
          level
        })
      });

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Error al solicitar sesión efímera al backend');
      }

      const ephemeralKey = sessionData.value || sessionData.client_secret?.value || sessionData.key;
      if (!ephemeralKey) {
        throw new Error('El servidor no devolvió una clave efímera válida.');
      }

      // 3. Create WebRTC Peer Connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setCallState('error');
          setErrorMessage(
            isSpanish
              ? 'La conexión de la llamada se ha interrumpido.'
              : 'Call connection lost.'
          );
        }
      };

      // 4. Setup remote audio element
      const remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      audioElementRef.current = remoteAudio;

      pc.ontrack = (e) => {
        if (remoteAudio) {
          remoteAudio.srcObject = e.streams[0];
          remoteAudio.play().catch((err) => {
            console.warn('Remote audio autoplay prevented:', err);
          });
        }
      };

      // 5. Add local mic track to connection
      localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // 6. Setup Data Channel for event streaming and transcriptions
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setCallState('listening');
        startDurationTimer();

        // Enable user input audio transcription via Whisper-1 on the session
        try {
          const sessionUpdate = {
            type: 'session.update',
            session: {
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          };
          dc.send(JSON.stringify(sessionUpdate));
          console.log('🎙️ Realtime session.update sent to enable input_audio_transcription (whisper-1)');
        } catch (updateErr) {
          console.warn('⚠️ Could not send session.update on DataChannel:', updateErr);
        }
      };

      dc.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          handleServerEvent(evt);
        } catch (parseErr) {
          console.warn('Could not parse realtime event:', parseErr);
        }
      };

      dc.onerror = (err) => {
        console.warn('Realtime DataChannel error:', err);
      };

      // 7. Create SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 8. Connect to OpenAI Realtime WebRTC endpoint with ephemeral token
      // Official GA endpoint: POST https://api.openai.com/v1/realtime/calls
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(
          isSpanish
            ? `Fallo al establecer enlace WebRTC con OpenAI: ${errorText}`
            : `Failed to establish WebRTC connection with OpenAI: ${errorText}`
        );
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

    } catch (err) {
      console.error('❌ Error in startCall:', err);
      cleanupResources();
      setCallState('error');
      setErrorMessage(err.message || 'Error desconocido al conectar la llamada.');
    }
  }, [targetLang, nativeLang, level, isSpanish, cleanupResources, handleServerEvent]);

  // Toggle Mute / Unmute on the local audio track (zero WebRTC reconnect delay)
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const nextMuted = !isMuted;
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsMuted(nextMuted);
    }
  }, [isMuted]);

  // End Call: teardown and return session metadata for saving
  const endCall = useCallback(() => {
    const finalSeconds = callDurationSecondsRef.current;
    const finalTranscript = [...liveTranscriptRef.current];

    cleanupResources();
    setCallState('idle');

    // Create session record
    const formattedDuration = formatSeconds(finalSeconds);
    const firstUserMsg = finalTranscript.find((m) => m.sender === 'user')?.text;
    const firstBotMsg = finalTranscript.find((m) => m.sender === 'bot')?.text;

    const summaryText = firstUserMsg
      ? (firstUserMsg.length > 55 ? `${firstUserMsg.slice(0, 52)}...` : firstUserMsg)
      : (firstBotMsg
          ? (firstBotMsg.length > 55 ? `${firstBotMsg.slice(0, 52)}...` : firstBotMsg)
          : (isSpanish ? 'Llamada de voz en tiempo real' : 'Real-time voice call'));

    const sessionRecord = {
      id: `call-${Date.now()}`,
      type: 'call',
      lang: targetLang,
      date: isSpanish ? 'Hoy' : 'Today',
      timestamp: Date.now(),
      duration: formattedDuration,
      summary: summaryText,
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
