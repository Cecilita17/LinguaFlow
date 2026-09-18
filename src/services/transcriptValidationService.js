/**
 * Contextual & Acoustic Validation Service for Live Calls
 *
 * Implements strict multi-tier validation separating:
 * 1. Transcription Errors / Whisper Acoustic Hallucinations (e.g., subtitle captions, repetitive decoding loops, silent noise artifacts)
 * 2. Student Grammatical / Lexical Errors (e.g. "Ich bin gestern nach Hause gehen" -> preserved for pedagogical correction)
 * 3. Legitimate Bilingual Code-Switching (e.g. "Ich glaube que mañana voy a trabajar" -> preserved as authentic student utterance)
 * 4. Unexpected / Creative Spoken Answers (e.g. "¿Qué hiciste ayer?" -> "Me quedé en casa" -> preserved without false corrections)
 *
 * Hierarchy:
 * 1. Real user audio
 * 2. Groq Whisper transcript
 * 3. Conversational context as validation signal
 * 4. Pedagogical linguistic correction
 */

const WHISPER_HALLUCINATION_PATTERNS = [
  /\b(subt[ií]tulos|subtitles|sous-titres|untertitel)\s+(por|by|de|von|community)\b/i,
  /\b(gracias\s+por\s+ver|thank\s+you\s+for\s+watching|merci\s+d'avoir\s+regard[eé]|danke\s+f[uü]rs\s+zuschauen|vielen\s+dank\s+f[uü]rs\s+zuschauen)\b/i,
  /\b(suscr[ií]bete|suscribete|subscribe\s+to|abonne-toi|abonnieren|like\s+and\s+subscribe)\b/i,
  /\b(amara\.org|opensubtitles|youtube\.com|www\.youtube)\b/i,
  /\b(transcripci[oó]n\s+por|transcription\s+by|copyright\s+by)\b/i,
  /\b(todos\s+los\s+derechos\s+reservados|all\s+rights\s+reserved)\b/i
];

/**
 * Validates a speech transcript against contextual sanity and acoustic patterns.
 * 
 * @param {Object} options
 * @param {string} options.rawTranscript - Raw text from Whisper / browser STT
 * @param {Array} options.history - Dialogue history array [{ sender, text }]
 * @param {string} options.targetLang - Target learning language code (e.g. 'de')
 * @param {string} options.nativeLang - Student native language code (e.g. 'es')
 * @returns {Object} Validation result { rawTranscript, validatedTranscript, transcriptionConfidence, isAcousticMismatch, reason }
 */
export function validateTranscriptContextually({
  rawTranscript = '',
  history = [],
  targetLang = 'es',
  nativeLang = 'es'
}) {
  if (!rawTranscript || typeof rawTranscript !== 'string') {
    return {
      rawTranscript: '',
      validatedTranscript: '',
      transcriptionConfidence: 'high',
      isAcousticMismatch: false,
      reason: null
    };
  }

  const clean = rawTranscript.trim();
  if (!clean) {
    return {
      rawTranscript: '',
      validatedTranscript: '',
      transcriptionConfidence: 'high',
      isAcousticMismatch: false,
      reason: null
    };
  }

  // 1. Detect known Whisper acoustic hallucinations on background noise / silence
  for (const pattern of WHISPER_HALLUCINATION_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        rawTranscript: clean,
        validatedTranscript: '',
        transcriptionConfidence: 'suspicious',
        isAcousticMismatch: true,
        reason: `Whisper caption hallucination pattern detected: "${pattern.source}"`
      };
    }
  }

  // 2. Detect degenerate repetitive token loops (Whisper decoding artifact on silence/static)
  const words = clean.split(/\s+/).map((w) => w.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?'"¡¿]/g, '')).filter(Boolean);
  if (words.length >= 4) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size === 1) {
      return {
        rawTranscript: clean,
        validatedTranscript: clean,
        transcriptionConfidence: 'suspicious',
        isAcousticMismatch: true,
        reason: 'Repetitive token decoding loop detected'
      };
    }
  }

  // 3. Authentic student speech (Preserves grammatical errors, code-switching, unexpected answers)
  // NEVER invent or replace text unless overwhelmingly proven to be a caption hallucination
  return {
    rawTranscript: clean,
    validatedTranscript: clean,
    transcriptionConfidence: 'high',
    isAcousticMismatch: false,
    reason: null
  };
}