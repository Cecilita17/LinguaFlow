const normalizeLanguage = (language) => String(language || '').toLowerCase().replace(/_/g, '-');

export function selectArabicSpeechVoice(voices, language = 'ar-SA') {
  const requested = normalizeLanguage(language);
  const arabic = voices.filter((voice) => normalizeLanguage(voice.lang).split('-')[0] === 'ar');
  return arabic.find((voice) => normalizeLanguage(voice.lang) === requested)
    || arabic.find((voice) => voice.default)
    || arabic[0]
    || null;
}

export async function waitForArabicSpeechVoice(synthesis, language, timeoutMs = 2000) {
  const initial = selectArabicSpeechVoice(synthesis.getVoices(), language);
  if (initial) return initial;
  return new Promise((resolve) => {
    let timeout;
    const finish = (voice) => {
      clearTimeout(timeout);
      synthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(voice);
    };
    const onVoicesChanged = () => {
      const voice = selectArabicSpeechVoice(synthesis.getVoices(), language);
      if (voice) finish(voice);
    };
    synthesis.addEventListener('voiceschanged', onVoicesChanged);
    timeout = setTimeout(() => finish(selectArabicSpeechVoice(synthesis.getVoices(), language)), timeoutMs);
    onVoicesChanged();
  });
}
