export const STUDY_GREETINGS = {
  zh: { text: '你好', translit: 'Nǐ hǎo', langName: 'Chino Mandarín' },
  pl: { text: 'Cześć', translit: null, langName: 'Polaco' },
  en: { text: 'Hello', translit: null, langName: 'Inglés' },
  es: { text: '¡Hola!', translit: null, langName: 'Español' },
  de: { text: 'Hallo', translit: null, langName: 'Alemán' },
  fr: { text: 'Bonjour', translit: null, langName: 'Francés' },
  it: { text: 'Ciao', translit: null, langName: 'Italiano' },
  nl: { text: 'Hallo', translit: null, langName: 'Nederlands' },
  ru: { text: 'Привет', translit: 'Privet', langName: 'Ruso' },
  ar: { text: 'مَرْحَبًا', translit: 'Marhaban', langName: 'Árabe', rtl: true },
  pt: { text: 'Olá', translit: null, langName: 'Portugués' },
  ja: { text: 'こんにちは', translit: 'Konnichiwa', langName: 'Japonés' },
  ko: { text: '안녕하세요', translit: 'Annyeonghaseyo', langName: 'Coreano' },
  tr: { text: 'Merhaba', translit: null, langName: 'Turco' }
};

export function getStudyGreeting(targetLang) {
  if (!targetLang) return STUDY_GREETINGS.en;
  const code = typeof targetLang === 'string' ? targetLang.toLowerCase() : (targetLang.code || 'en').toLowerCase();
  return STUDY_GREETINGS[code] || STUDY_GREETINGS.en;
}
