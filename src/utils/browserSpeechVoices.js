export const BROWSER_VOICE_STORAGE_KEY = 'linguaflow_browser_voice_preferences';

export function speechLanguageKey(language = '') {
  return String(language).toLowerCase().replaceAll('_', '-').split('-')[0];
}

export function browserVoiceId(voice) {
  return JSON.stringify([voice.voiceURI || '', voice.name || '', voice.lang || '']);
}

export function matchingBrowserVoices(voices = [], language = '') {
  const key = speechLanguageKey(language);
  return key ? voices.filter(voice => speechLanguageKey(voice.lang) === key) : [];
}

export function resolveBrowserVoice(voices, language, preferences = {}) {
  const candidates = matchingBrowserVoices(voices, language);
  const preference = preferences[speechLanguageKey(language)];
  return candidates.find(voice => browserVoiceId(voice) === preference) || candidates[0] || null;
}

export function normalizeBrowserVoicePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, id]) => /^[a-z]{2,3}$/.test(key) && typeof id === 'string' && id.length < 2000));
}

export const BROWSER_VOICE_SAMPLES = {
  es: '¡Hola! ¿De qué querés hablar hoy?',
  en: 'Hello! What would you like to talk about today?',
  fr: "Bonjour ! De quoi veux-tu parler aujourd’hui ?",
  de: 'Hallo! Worüber möchtest du heute sprechen?',
  it: 'Ciao! Di cosa vuoi parlare oggi?',
  pt: 'Olá! Sobre o que você quer conversar hoje?',
  ru: 'Привет! О чём ты хочешь поговорить сегодня?',
  pl: 'Cześć! O czym chcesz dzisiaj porozmawiać?',
  nl: 'Hallo! Waar wil je vandaag over praten?',
  tr: 'Merhaba! Bugün ne hakkında konuşmak istersin?',
  zh: '你好！今天你想聊什么？',
  ar: 'مرحبًا! عن ماذا تريد أن تتحدث اليوم؟',
  ja: 'こんにちは！今日は何について話したいですか？',
  ko: '안녕하세요! 오늘은 무엇에 대해 이야기하고 싶으세요?'
};
