import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Enhanced Speech Hook with Push-to-Talk (Press & Hold up to 1 min),
 * Live Audio Transcription, and Text-to-Speech (TTS).
 */
export function useSpeech({
  targetLangCode = 'es-ES',
  onSpeechResult,
  handsFree = false,
  isProcessing = false
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef(null);
  const fullTranscriptRef = useRef('');
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const isHandsFreeRef = useRef(handsFree);
  const isSpeakingRef = useRef(isSpeaking);
  const isProcessingRef = useRef(isProcessing);
  const isRecordingRef = useRef(false);

  isHandsFreeRef.current = handsFree;
  isSpeakingRef.current = isSpeaking;
  isProcessingRef.current = isProcessing;
  isRecordingRef.current = isRecording;

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = targetLangCode;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      // Speech recognition started
    };

    recognition.onresult = (event) => {
      let currentInterim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          currentFinal += transcriptPart + ' ';
        } else {
          currentInterim += transcriptPart;
        }
      }

      if (currentFinal) {
        fullTranscriptRef.current = (fullTranscriptRef.current + ' ' + currentFinal).trim();
      }

      const displayTranscript = (fullTranscriptRef.current + ' ' + currentInterim).trim();
      setInterimTranscript(displayTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition warning:', event.error);
      }
    };

    recognition.onend = () => {
      // If currently recording and recognition stopped unexpectedly, try to restart unless duration reached
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch (e) {}
    };
  }, [targetLangCode]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Stop Recording helper (ends timer and resolves recorded text)
  const stopRecordingInternal = useCallback((shouldSend = true) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsRecording(false);
    isRecordingRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const recordedText = (fullTranscriptRef.current || interimTranscript || '').trim();
    fullTranscriptRef.current = '';
    setInterimTranscript('');
    setRecordingSeconds(0);

    if (shouldSend && recordedText && onSpeechResult) {
      onSpeechResult(recordedText);
    }

    return recordedText;
  }, [interimTranscript, onSpeechResult]);

  // Start Push-to-Talk Recording (Called on MouseDown / TouchStart)
  const startRecording = useCallback(() => {
    if (isProcessing) return;

    // Cancel any active bot speaking
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    fullTranscriptRef.current = '';
    setInterimTranscript('');
    setRecordingSeconds(0);
    setIsRecording(true);
    isRecordingRef.current = true;
    startTimeRef.current = Date.now();

    // Start 1-minute max countdown / counter
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setRecordingSeconds(elapsedSec);

      // Max 1 minute (60 seconds) reached: auto-send
      if (elapsedSec >= 60) {
        stopRecordingInternal(true);
      }
    }, 250);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = targetLangCode;
        recognitionRef.current.start();
      } catch (e) {
        // Recognition might already be active
      }
    }
  }, [isProcessing, targetLangCode, stopRecordingInternal]);

  // Stop Push-to-Talk Recording (Called on MouseUp / TouchEnd)
  const stopRecording = useCallback(() => {
    const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) : 0;
    // If held for less than 300ms, consider it a tap/accidental click
    if (elapsed < 300 && !fullTranscriptRef.current && !interimTranscript) {
      stopRecordingInternal(false);
      return;
    }

    // Wait a brief 200ms to allow final words from Web Speech engine
    setTimeout(() => {
      stopRecordingInternal(true);
    }, 200);
  }, [interimTranscript, stopRecordingInternal]);

  // Cancel Recording (Called on mouse leave / drag off)
  const cancelRecording = useCallback(() => {
    stopRecordingInternal(false);
  }, [stopRecordingInternal]);

  // Text to Speech (TTS)
  const speakText = useCallback((text, langCode = targetLangCode, rate = 0.95, onEndCallback) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langCode;
    utterance.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.slice(0, 2).toLowerCase()));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEndCallback) onEndCallback();
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [targetLangCode]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isRecording,
    recordingSeconds,
    isSpeaking,
    speechSupported,
    interimTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
    speakText,
    stopSpeaking
  };
}
