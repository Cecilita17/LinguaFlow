import { useState, useRef, useEffect, useCallback } from 'react';

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

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioElementRef = useRef(null);
  const durationTimerRef = useRef(null);

  const liveTranscriptRef = useRef([]);
  const callDurationSecondsRef = useRef(0);
  const currentAiTurnIdRef = useRef(null);
  const currentAiTurnTextRef = useRef('');

  // Keep refs in sync with state for access inside event handlers
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  useEffect(() => {
    callDurationSecondsRef.current = callDurationSeconds;
  }, [callDurationSeconds]);

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

  // Handle incoming OpenAI Realtime Data Channel events
  const handleServerEvent = useCallback((event) => {
    switch (event.type) {
      // User started speaking -> Server VAD detected barge-in/interruption
      case 'input_audio_buffer.speech_started': {
        setCallState('listening');
        // Finalize current AI turn if any
        currentAiTurnTextRef.current = '';
        currentAiTurnIdRef.current = `bot-${Date.now()}`;
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
          try {
            dataChannelRef.current.send(JSON.stringify({ type: 'response.cancel' }));
          } catch (e) {}
        }
        break;
      }

      // User finished speaking and speech was recognized by whisper-1
      case 'conversation.item.input_audio_transcription.completed': {
        const userText = event.transcript ? event.transcript.trim() : '';
        if (userText) {
          setLiveTranscript((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sender: 'user',
              speaker: isSpanish ? 'Tú' : 'You',
              text: userText
            }
          ]);
        }
        break;
      }

      // AI response is being planned
      case 'response.created': {
        setCallState('thinking');
        currentAiTurnTextRef.current = '';
        currentAiTurnIdRef.current = `bot-${Date.now()}`;
        break;
      }

      // AI is actively streaming response audio and transcript deltas
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        setCallState('speaking');
        const delta = event.delta || '';
        currentAiTurnTextRef.current += delta;
        const currentTurnId = currentAiTurnIdRef.current;

        setLiveTranscript((prev) => {
          const index = prev.findIndex((item) => item.id === currentTurnId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              text: currentAiTurnTextRef.current
            };
            return updated;
          } else {
            return [
              ...prev,
              {
                id: currentTurnId,
                sender: 'bot',
                speaker: 'LinguaFlow AI',
                text: currentAiTurnTextRef.current
              }
            ];
          }
        });
        break;
      }

      // Turn finished
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
      case 'response.done': {
        setCallState('listening');
        currentAiTurnTextRef.current = '';
        currentAiTurnIdRef.current = `bot-${Date.now()}`;
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
  }, [isSpanish]);

  // Start Realtime Call
  const startCall = useCallback(async () => {
    try {
      cleanupResources();
      setCallState('connecting');
      setErrorMessage(null);
      setLiveTranscript([]);
      setIsMuted(false);
      currentAiTurnTextRef.current = '';
      currentAiTurnIdRef.current = `bot-${Date.now()}`;

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
      transcript: finalTranscript
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
    callDurationSeconds,
    formattedDuration: formatSeconds(callDurationSeconds),
    startCall,
    endCall,
    toggleMute
  };
}
