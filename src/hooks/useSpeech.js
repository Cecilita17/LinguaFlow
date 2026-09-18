import { useState, useEffect, useRef, useCallback } from 'react';
import { transcribeAudioApi } from '../services/chatService.js';
import { mapSpeechRateToUtteranceRate } from '../context/AudioSettingsContext.jsx';

/**
 * Strips secondary subtitle/translation artifacts produced by STT engines when transcribing
 * multilingual speech with natural code-switching.
 */
export function stripSttTranslationArtifacts(text, targetLang = 'es') {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (!cleaned) return '';

  // 1. Remove bracketed / parenthetical translation or subtitle notes:
  // e.g. [Translation: ...], (English: ...), [Translated from Russian: ...]
  cleaned = cleaned
    .replace(/\[\s*(?:translated|english|translation|subtitles?|traducci[oó]n|en|es)?\s*:?[^\]]*\]/gi, '')
    .replace(/\(\s*(?:translated|english|translation|subtitles?|traducci[oó]n|en|es)\s*:?[^\)]*\)/gi, '')
    .trim();

  // 2. Multi-line handling: Whisper subtitle format (Line 1: original/code-switch, Line 2: English/secondary translation)
  const lines = cleaned.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0370-\u03FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F]/;

    if (nonLatinRegex.test(lines[0])) {
      const nonLatinLines = lines.filter(l => nonLatinRegex.test(l));
      if (nonLatinLines.length > 0 && nonLatinLines.length < lines.length) {
        cleaned = nonLatinLines.join(' ');
      } else {
        cleaned = lines[0];
      }
    } else {
      cleaned = lines[0];
    }
  }

  // 3. Inline sentence translation handling (e.g. "Russian sentence. English translation.")
  const sentenceMatches = cleaned.match(/[^.!?]+[.!?]*/g);
  if (sentenceMatches && sentenceMatches.length >= 2) {
    const s1 = sentenceMatches[0].trim();
    const s2 = sentenceMatches.slice(1).join(' ').trim();
    const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0370-\u03FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F]/;

    // If Sentence 1 has non-Latin characters (e.g. Russian, Arabic, Chinese) and Sentence 2 has NO non-Latin characters (pure Latin/English)
    if (nonLatinRegex.test(s1) && !nonLatinRegex.test(s2)) {
      cleaned = s1;
    }
  }

  return cleaned.trim();
}

/**
 * Intelligent phrase and n-gram deduplication to fix Android Chrome / mobile WebKit
 * phrase repetition bug: e.g. "la casa la casa la casa es roja la casa es roja" -> "la casa es roja"
 */
export function cleanDuplicatePhrases(text, targetLang = 'es') {
  if (!text || typeof text !== 'string') return '';
  let cleaned = stripSttTranslationArtifacts(text, targetLang);
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
 * 3. MediaRecorder raw audio capture + Groq Whisper Audio transcription
 *    (exceptional accuracy for strong foreign accents & mixed language code-switching)
 * 4. Text-to-Speech (TTS)
 */
export function useSpeech({
  targetLangCode = 'es-ES',
  targetLang = 'es',
  nativeLang = 'es',
  apiKey = '',
  provider = 'groq',
  onSpeechResult,
  handsFree = false,
  isProcessing = false
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingCharIndex, setSpeakingCharIndex] = useState(-1);
  const [speakingText, setSpeakingText] = useState('');
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
  const mediaStreamPromiseRef = useRef(null);
  const playbackIdRef = useRef(0);

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

    // Await any in-flight media stream initialization
    if (mediaStreamPromiseRef.current) {
      try {
        await mediaStreamPromiseRef.current;
      } catch (e) {}
      mediaStreamPromiseRef.current = null;
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
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
          const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
          resolve(blob);
        }, 600));
        audioBlob = await Promise.race([stopPromise, timeoutPromise]);
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
      mediaRecorderRef.current = null;
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

    // High-precision Groq Whisper Multilingual Transcription (for code-switching & accents)
    let finalTranscribedText = localTranscript;

    if (audioBlob && audioBlob.size > 150) {
      try {
        setIsTranscribingAudio(true);
        const aiTranscript = await transcribeAudioApi({
          audioBlob,
          targetLang,
          nativeLang,
          apiKey,
          provider
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
  }, [interimTranscript, onSpeechResult, targetLang, nativeLang, apiKey, provider]);

  // Start Push-to-Talk Recording (Called on PointerDown)
  const startRecording = useCallback(async () => {
    if (isProcessing) return;

    // Increment playbackId to discard callbacks from any in-flight utterance
    playbackIdRef.current++;

    // Cancel any active bot speaking
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingCharIndex(-1);
      setSpeakingText('');
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

    // 2. Universal audio capture via MediaRecorder (for Groq Whisper multilingual code-switching transcription)
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStreamPromiseRef.current = navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // If recording already stopped before mic initialized, release tracks immediately
          if (!isRecordingRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return null;
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
            recorder.start(100);
            return recorder;
          }
          return null;
        })
        .catch((audioErr) => {
          console.warn('MediaRecorder audio capture notice:', audioErr.message);
          return null;
        });
    }
  }, [isProcessing, targetLangCode, stopRecordingInternal]);

  // Stop Push-to-Talk or Click-to-Talk Recording
  const stopRecording = useCallback(() => {
    // Allow a tiny 150ms buffer to finalize the last syllables
    setTimeout(() => {
      stopRecordingInternal(true);
    }, 150);
  }, [stopRecordingInternal]);

  // Cancel Recording (Called on drag off or cancel gesture)
  const cancelRecording = useCallback(() => {
    stopRecordingInternal(false);
  }, [stopRecordingInternal]);

  // Text to Speech (TTS)
  const speakText = useCallback((text, langCode = targetLangCode, rate = 0.95, onEndCallback, onBoundaryCallback) => {
    const playbackId = ++playbackIdRef.current;
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) return;

    setSpeakingText(cleanText);
    setSpeakingCharIndex(0);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langCode;
    utterance.rate = mapSpeechRateToUtteranceRate(rate);

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.slice(0, 2).toLowerCase()));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      if (playbackId !== playbackIdRef.current) return;
      setIsSpeaking(true);
      setSpeakingCharIndex(0);
    };

    utterance.onboundary = (event) => {
      if (playbackId !== playbackIdRef.current) return;
      if (typeof event.charIndex === 'number' && event.charIndex >= 0) {
        setSpeakingCharIndex(event.charIndex);
      }
      if (onBoundaryCallback) {
        onBoundaryCallback(event);
      }
    };

    utterance.onend = () => {
      if (playbackId !== playbackIdRef.current) return;
      setIsSpeaking(false);
      setSpeakingCharIndex(-1);
      setSpeakingText('');
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      if (playbackId !== playbackIdRef.current) return;
      setIsSpeaking(false);
      setSpeakingCharIndex(-1);
      setSpeakingText('');
    };

    window.speechSynthesis.speak(utterance);
  }, [targetLangCode]);

  const stopSpeaking = useCallback(() => {
    playbackIdRef.current++;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingCharIndex(-1);
    setSpeakingText('');
  }, []);

  return {
    isRecording,
    recordingSeconds,
    isTranscribingAudio,
    isSpeaking,
    speakingCharIndex,
    speakingText,
    speechSupported,
    interimTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
    speakText,
    stopSpeaking
  };
}
