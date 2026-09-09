import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeech({
  targetLangCode = 'es-ES',
  onSpeechResult,
  handsFree = false,
  isProcessing = false
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef(null);
  const isHandsFreeRef = useRef(handsFree);
  const isSpeakingRef = useRef(isSpeaking);
  const isProcessingRef = useRef(isProcessing);

  isHandsFreeRef.current = handsFree;
  isSpeakingRef.current = isSpeaking;
  isProcessingRef.current = isProcessing;

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = targetLangCode;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event) => {
      let finalStr = '';
      let interimStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }

      setInterimTranscript(interimStr);

      if (finalStr.trim() && onSpeechResult) {
        setInterimTranscript('');
        onSpeechResult(finalStr.trim());
      }
    };

    recognition.onerror = (event) => {
      // Ignore routine aborts
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');

      // If hands-free is enabled and we are not speaking and not processing, resume listening
      if (isHandsFreeRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        setTimeout(() => {
          if (isHandsFreeRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // already started
            }
          }
        }, 600);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch (e) {}
    };
  }, [targetLangCode, onSpeechResult]);

  // Handle Hands-Free loop triggers
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (handsFree && !isListening && !isSpeaking && !isProcessing) {
      const timer = setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }, 500);
      return () => clearTimeout(timer);
    } else if (!handsFree && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, [handsFree, isListening, isSpeaking, isProcessing]);

  // Manual start / stop listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      recognitionRef.current.lang = targetLangCode;
      recognitionRef.current.start();
    } catch (e) {
      console.warn('Error starting speech recognition:', e);
    }
  }, [targetLangCode]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
  }, []);

  // Text to Speech
  const speakText = useCallback((text, langCode = targetLangCode, rate = 0.95, onEndCallback) => {
    if (!window.speechSynthesis) return;

    // Abort active recognition while bot speaks
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    window.speechSynthesis.cancel();

    // Clean any markup for TTS
    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langCode;
    utterance.rate = rate;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(langCode.slice(0, 2)));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEndCallback) onEndCallback();

      // Resume hands-free listening if enabled
      if (isHandsFreeRef.current && recognitionRef.current) {
        setTimeout(() => {
          if (isHandsFreeRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }
        }, 500);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [targetLangCode]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    speechSupported,
    interimTranscript,
    startListening,
    stopListening,
    speakText,
    stopSpeaking
  };
}
