import { useState, useEffect, useRef, useCallback } from 'react';
import { transcribeAudioApi } from '../services/chatService.js';

/**
 * Intelligent phrase and n-gram deduplication to fix Android Chrome / mobile WebKit
 * phrase repetition bug: e.g. "la casa la casa la casa es roja la casa es roja" -> "la casa es roja"
 */
export function cleanDuplicatePhrases(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (!cleaned) return '';

  // 1. Remove duplicate adjacent sentences
  const sentenceDelim = /([.!?]+|\n+)/;
  const rawParts = cleaned.split(sentenceDelim);
  if (rawParts.length > 2) {
    let deduped = [];
    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i].trim();
      if (!part) continue;
      if (deduped.length > 0 && part.toLowerCase() === deduped[deduped.length - 1].toLowerCase()) {
        continue;
      }
      deduped.push(part);
    }
    cleaned = deduped.join(' ');
  }

  // 2. Token-level iterative deduplication for n-grams (from 8 down to 1)
  let words = cleaned.split(/\s+/).filter(Boolean);
  let changed = true;
  let passes = 0;

  while (changed && passes < 4) {
    changed = false;
    passes++;
    let result = [];
    let i = 0;

    while (i < words.length) {
      let matchedGram = 0;
      const maxGram = Math.min(8, Math.floor((words.length - i) / 2));

      for (let k = maxGram; k >= 1; k--) {
        const gram1 = words.slice(i, i + k).map(w => w.toLowerCase().replace(/[,.?!:;]/g, '')).join(' ');
        const gram2 = words.slice(i + k, i + 2 * k).map(w => w.toLowerCase().replace(/[,.?!:;]/g, '')).join(' ');

        if (gram1 && gram1 === gram2) {
          matchedGram = k;
          break;
        }
      }

      if (matchedGram > 0) {
        result.push(...words.slice(i, i + matchedGram));
        i += matchedGram * 2;
        changed = true;
      } else {
        result.push(words[i]);
        i++;
      }
    }

    words = result;
  }

  return words.join(' ').replace(/\s+([,.:;?!])/g, '$1').trim();
}

/**
 * Enhanced Speech Hook with:
 * 1. Push-to-Talk Pointer Events (instant stop & send on release, no 1-min hang)
 * 2. Deduplicated real-time speech preview (fixes mobile phrase repetition)
 * 3. MediaRecorder raw audio capture + Gemini Multimodal Audio transcription
 *    (exceptional accuracy for strong foreign accents & mixed language code-switching)
 * 4. Text-to-Speech (TTS)
 */
export function useSpeech({
  targetLangCode = 'es-ES',
  targetLang = 'es',
  nativeLang = 'es',
  apiKey = '',
  onSpeechResult,
  handsFree = false,
  isProcessing = false
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
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

  // Audio capture refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');

  isHandsFreeRef.current = handsFree;
  isSpeakingRef.current = isSpeaking;
  isProcessingRef.current = isProcessing;
  isRecordingRef.current = isRecording;

  // Initialize Speech Recognition for live visual feedback
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const recognition = new SpeechRecognition();
    // On mobile devices, continuous mode causes freezing or duplication in Android Chrome.
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = targetLangCode;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          fullTranscriptRef.current = (fullTranscriptRef.current ? fullTranscriptRef.current + ' ' : '') + text;
        } else {
          interim += text;
        }
      }

      const combined = cleanDuplicatePhrases((fullTranscriptRef.current + ' ' + interim).trim());
      setInterimTranscript(combined);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition status:', event.error);
      }
    };

    recognition.onend = () => {
      // If currently recording on mobile and recognition ended, restart to keep capturing while held
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

  // Clean up timer and media tracks on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Internal helper to stop recording and process speech / audio
  const stopRecordingInternal = useCallback(async (shouldSend = true) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsRecording(false);
    isRecordingRef.current = false;

    // Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // Stop MediaRecorder and get audio blob
    let audioBlob = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        const stopPromise = new Promise(resolve => {
          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
            resolve(blob);
          };
          mediaRecorderRef.current.stop();
        });
        audioBlob = await stopPromise;
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
    } else if (audioChunksRef.current.length > 0) {
      audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
    }

    // Release microphone stream hardware lock
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }

    const localTranscript = cleanDuplicatePhrases((fullTranscriptRef.current || interimTranscript || '').trim());
    fullTranscriptRef.current = '';
    setInterimTranscript('');
    setRecordingSeconds(0);

    if (!shouldSend) {
      audioChunksRef.current = [];
      return;
    }

    // High-precision AI Multimodal Audio Transcription (for strong accents & mixed language)
    let finalTranscribedText = localTranscript;

    if (audioBlob && audioBlob.size > 1500) {
      try {
        setIsTranscribingAudio(true);
        const aiTranscript = await transcribeAudioApi({
          audioBlob,
          targetLang,
          nativeLang,
          apiKey
        });

        if (aiTranscript && aiTranscript.trim()) {
          console.log('Using AI Multimodal Audio transcription:', aiTranscript);
          finalTranscribedText = cleanDuplicatePhrases(aiTranscript.trim());
        }
      } catch (err) {
        console.warn('AI transcription fallback to Web Speech:', err);
      } finally {
        setIsTranscribingAudio(false);
      }
    }

    audioChunksRef.current = [];

    if (finalTranscribedText && onSpeechResult) {
      onSpeechResult(finalTranscribedText);
    }
  }, [interimTranscript, onSpeechResult, targetLang, nativeLang, apiKey]);

  // Start Push-to-Talk Recording (Called on PointerDown)
  const startRecording = useCallback(async () => {
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
    audioChunksRef.current = [];

    // Start 1-minute max countdown / counter
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setRecordingSeconds(elapsedSec);

      // Max 1 minute (60 seconds) reached: auto-send immediately
      if (elapsedSec >= 60) {
        stopRecordingInternal(true);
      }
    }, 250);

    // 1. Immediately and synchronously start Web Speech recognition
    // (CRITICAL: Mobile Chrome requires recognition.start() to execute synchronously inside the user-gesture event loop)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = targetLangCode;
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech recognition start notice:', e.message);
      }
    }

    // 2. Non-blocking audio capture via MediaRecorder (for multimodal AI transcription when apiKey is present)
    // CRITICAL: On mobile devices (Android / iOS), concurrent getUserMedia steals exclusive AudioRecord
    // focus away from Web Speech recognition. Therefore, on mobile or when no apiKey is supplied,
    // Web Speech recognition runs with exclusive access for maximum accuracy and speed.
    const isMobileDevice = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobileDevice && (apiKey || '').trim() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // If recording already stopped before mic initialized, release tracks immediately
          if (!isRecordingRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          audioStreamRef.current = stream;

          let selectedMime = 'audio/webm;codecs=opus';
          if (typeof MediaRecorder !== 'undefined') {
            if (!MediaRecorder.isTypeSupported(selectedMime)) {
              if (MediaRecorder.isTypeSupported('audio/webm')) selectedMime = 'audio/webm';
              else if (MediaRecorder.isTypeSupported('audio/mp4')) selectedMime = 'audio/mp4';
              else if (MediaRecorder.isTypeSupported('audio/aac')) selectedMime = 'audio/aac';
              else selectedMime = '';
            }

            mimeTypeRef.current = selectedMime || 'audio/webm';
            const options = selectedMime ? { mimeType: selectedMime } : {};
            const recorder = new MediaRecorder(stream, options);

            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                audioChunksRef.current.push(e.data);
              }
            };

            mediaRecorderRef.current = recorder;
            recorder.start(250);
          }
        })
        .catch((audioErr) => {
          console.warn('MediaRecorder audio capture notice:', audioErr.message);
        });
    }
  }, [isProcessing, targetLangCode, stopRecordingInternal]);

  // Stop Push-to-Talk Recording (Called on PointerUp)
  const stopRecording = useCallback(() => {
    const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) : 0;
    // If held for less than 250ms with zero words, consider it an accidental tap
    if (elapsed < 250 && !fullTranscriptRef.current && !interimTranscript && audioChunksRef.current.length === 0) {
      stopRecordingInternal(false);
      return;
    }

    // Allow a tiny 150ms buffer to finalize the last syllables
    setTimeout(() => {
      stopRecordingInternal(true);
    }, 150);
  }, [interimTranscript, stopRecordingInternal]);

  // Cancel Recording (Called on drag off or cancel gesture)
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
    isTranscribingAudio,
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
