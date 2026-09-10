import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { WordModal } from './components/WordModal';
import { InputBar } from './components/InputBar';
import { SettingsModal } from './components/SettingsModal';
import { GrammarBreakdownModal } from './components/GrammarBreakdownModal';
import { YouTubeReaderPage } from './pages/YouTubeReaderPage';
import { TextReaderPage } from './pages/TextReaderPage';
import HomePage from './pages/HomePage';
import { useSpeech } from './hooks/useSpeech';
import { Sparkles, RotateCcw } from 'lucide-react';
import { API_BASE_URL, sendChatMessage, lookupWordApi, fetchLanguagesApi } from './services/chatService';
import { generateSentenceBreakdown, getOrFetchSentenceBreakdown } from './services/sentenceBreakdownEngine';
import { useSiteLanguage } from './context/SiteLanguageContext.jsx';
import { useAudioSettings } from './context/AudioSettingsContext.jsx';

const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', speechCode: 'es-ES', hasTranslit: false },
  { code: 'en', name: 'Inglés', speechCode: 'en-US', hasTranslit: false },
  { code: 'nl', name: 'Nederlands', speechCode: 'nl-NL', hasTranslit: false },
  { code: 'pl', name: 'Polaco', speechCode: 'pl-PL', hasTranslit: false },
  { code: 'de', name: 'Alemán', speechCode: 'de-DE', hasTranslit: false },
  { code: 'fr', name: 'Francés', speechCode: 'fr-FR', hasTranslit: false },
  { code: 'it', name: 'Italiano', speechCode: 'it-IT', hasTranslit: false },
  { code: 'ar', name: 'Árabe', speechCode: 'ar-SA', hasTranslit: true, translitName: 'Romanización', rtl: true },
  { code: 'zh', name: 'Chino Mandarín', speechCode: 'zh-CN', hasTranslit: true, translitName: 'Pinyin' },
  { code: 'ru', name: 'Ruso', speechCode: 'ru-RU', hasTranslit: true, translitName: 'Romanización' }
];

const STORAGE_PREFIX = 'linguaflow_chat_';
const TARGET_LANG_KEY = 'linguaflow_target_lang';
const NATIVE_LANG_KEY = 'linguaflow_native_lang';

function getSavedChat(lang) {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${lang}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(m => m && typeof m === 'object' && (m.text || m.tokens || m.sender));
        if (valid.length > 0) return valid;
      }
    }
  } catch (e) {
    console.warn(`Failed to parse saved chat for ${lang}:`, e);
  }
  return null;
}

function saveChatToStorage(lang, messagesList) {
  try {
    if (Array.isArray(messagesList)) {
      if (messagesList.length > 0) {
        localStorage.setItem(`${STORAGE_PREFIX}${lang}`, JSON.stringify(messagesList));
      } else {
        localStorage.removeItem(`${STORAGE_PREFIX}${lang}`);
      }
    }
  } catch (e) {
    console.warn(`Failed to save chat for ${lang}:`, e);
  }
}

export default function App() {
  const { t, isSpanish } = useSiteLanguage();
  const [languages, setLanguages] = useState(SUPPORTED_LANGUAGES);
  const [targetLang, setTargetLang] = useState(() => {
    try {
      return localStorage.getItem(TARGET_LANG_KEY) || 'pl';
    } catch (e) {
      return 'pl';
    }
  });

  // Fetch supported languages dynamically from Render backend
  useEffect(() => {
    async function loadLanguages() {
      const remoteLangs = await fetchLanguagesApi();
      if (remoteLangs && Array.isArray(remoteLangs) && remoteLangs.length > 0) {
        setLanguages(remoteLangs);
      }
    }
    loadLanguages();
  }, []);

  const [nativeLang, setNativeLang] = useState(() => {
    try {
      return localStorage.getItem(NATIVE_LANG_KEY) || 'es';
    } catch (e) {
      return 'es';
    }
  });
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [messages, setMessages] = useState(() => {
    const initialLang = (() => {
      try {
        return localStorage.getItem(TARGET_LANG_KEY) || 'pl';
      } catch (e) {
        return 'pl';
      }
    })();
    const saved = getSavedChat(initialLang);
    if (saved) return saved;
    const initialGreeting = getInitialBotMsg(initialLang);
    saveChatToStorage(initialLang, [initialGreeting]);
    return [initialGreeting];
  });
  const [selectedWord, setSelectedWord] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'chat' | 'youtube'

  const activeLangRef = useRef(targetLang);

  // Switch target language and persist chat state per language
  const handleTargetLangChange = (newLangInput) => {
    const newLang = typeof newLangInput === 'string' ? newLangInput : (newLangInput?.code || newLangInput?.target?.value || 'pl');
    if (!newLang || newLang === targetLang) return;

    // 1. Save current messages to active language before switching
    if (messages && messages.length > 0) {
      saveChatToStorage(activeLangRef.current, messages);
    }

    // 2. Load saved chat for newLang or initialize greeting
    const savedForNewLang = getSavedChat(newLang);
    const nextMessages = savedForNewLang || [getInitialBotMsg(newLang)];

    // 3. Update state & active reference
    activeLangRef.current = newLang;
    setTargetLang(newLang);
    setMessages(nextMessages);

    try {
      localStorage.setItem(TARGET_LANG_KEY, newLang);
      if (!savedForNewLang) {
        saveChatToStorage(newLang, nextMessages);
      }
    } catch (e) {}

    stopSpeaking();
  };

  const handleNativeLangChange = (newLangInput) => {
    const newLang = typeof newLangInput === 'string' ? newLangInput : (newLangInput?.code || newLangInput?.target?.value || 'es');
    if (!newLang) return;
    setNativeLang(newLang);
    try {
      localStorage.setItem(NATIVE_LANG_KEY, newLang);
    } catch (e) {}
  };

  // Delete message handler
  const handleDeleteMessage = (messageId) => {
    if (!messageId) return;
    setMessages((prev) => {
      const updated = prev.filter((m) => m && m.id !== messageId);
      saveChatToStorage(targetLang, updated);
      return updated;
    });
  };

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('linguaflow_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.provider = 'groq';
        return parsed;
      } catch (e) {}
    }
    return { provider: 'groq', apiKey: '', level: 'A2/B1', speechRate: 0.95 };
  });
  const [apiWarning, setApiWarning] = useState(null);

  const { speechRate, autoPlayAi } = useAudioSettings();
  const playedBotMsgIdsRef = useRef(new Set());
  const chatContainerRef = useRef(null);
  const currentLangObj = (languages && languages.find((l) => l && l.code === targetLang)) || (languages && languages[0]) || SUPPORTED_LANGUAGES[0] || { name: 'Español', speechCode: 'es-ES' };

  // Speech Hook (Push-to-Talk Press & Hold up to 1 min + TTS)
  const {
    isRecording,
    recordingSeconds,
    isTranscribingAudio,
    isSpeaking,
    interimTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
    speakText,
    stopSpeaking
  } = useSpeech({
    targetLangCode: currentLangObj.speechCode,
    targetLang,
    nativeLang,
    apiKey: config?.apiKey || '',
    provider: config?.provider || 'groq',
    handsFree,
    isProcessing,
    onSpeechResult: (spokenText) => {
      handleSendMessage(spokenText);
    }
  });

  // Save config
  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    setApiWarning(null);
    localStorage.setItem('linguaflow_config', JSON.stringify(newConfig));
  };

  // State for Sentence Grammar Breakdown modal and Re-analysis
  const [breakdownData, setBreakdownData] = useState(null);
  const [isBreakdownLoading, setIsBreakdownLoading] = useState(false);
  const [isReanalyzingId, setIsReanalyzingId] = useState(null);

  // Open Grammar Breakdown modal with instantaneous local preview + deep AI analysis
  const handleOpenGrammarBreakdown = async (msg) => {
    const correctedText = msg.correctedText || msg.text;
    const originalText = msg.originalText || msg.text;

    // 1. Initial fast breakdown so modal opens instantly with zero lag
    const initialBreakdown = generateSentenceBreakdown(correctedText, originalText, targetLang, nativeLang);
    setBreakdownData({
      breakdown: initialBreakdown,
      originalText,
      correctedText
    });
    setIsBreakdownLoading(true);

    // 2. Fetch authentic deep grammatical analysis from Groq AI
    try {
      const fullBreakdown = await getOrFetchSentenceBreakdown({
        correctedText,
        originalText,
        targetLang,
        nativeLang,
        apiKey: config?.apiKey || ''
      });
      if (fullBreakdown && fullBreakdown.length > 0) {
        setBreakdownData({
          breakdown: fullBreakdown,
          originalText,
          correctedText
        });
      }
    } catch (e) {
      console.warn('Grammar breakdown fetch notice:', e);
    } finally {
      setIsBreakdownLoading(false);
    }
  };

  // Initial greeting helper per target language
  function getInitialBotMsg(targetLang) {
    let initialBotMsg;
    if (targetLang === 'pl') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Cześć! Bardzo się cieszę, że mogę z tobą rozmawiać po polsku. O czym chcesz dzisiaj pogadać?',
        translation: '¡Hola! Me alegro mucho de poder hablar en polaco contigo. ¿De qué quieres charlar hoy?',
        tokens: [
          { word: 'Cześć!', clean_word: 'cześć', translit: null },
          { word: 'Bardzo', clean_word: 'bardzo', translit: null },
          { word: 'się', clean_word: 'się', translit: null },
          { word: 'cieszę,', clean_word: 'cieszę', translit: null },
          { word: 'że', clean_word: 'że', translit: null },
          { word: 'mogę', clean_word: 'mogę', translit: null },
          { word: 'z', clean_word: 'z', translit: null },
          { word: 'tobą', clean_word: 'tobą', translit: null },
          { word: 'rozmawiać', clean_word: 'rozmawiać', translit: null },
          { word: 'po', clean_word: 'po', translit: null },
          { word: 'polsku.', clean_word: 'polsku', translit: null },
          { word: 'O', clean_word: 'o', translit: null },
          { word: 'czym', clean_word: 'czym', translit: null },
          { word: 'chcesz', clean_word: 'chcesz', translit: null },
          { word: 'dzisiaj', clean_word: 'dzisiaj', translit: null },
          { word: 'pogadać?', clean_word: 'pogadać', translit: null }
        ],
        vocabulary: {
          'cześć': { meaning: 'Hola (saludo habitual)', part_of_speech: 'saludo' },
          'cieszę się': { meaning: 'Me alegro / me da gusto', part_of_speech: 'frase verbal' },
          'rozmawiać': { meaning: 'Hablar o conversar', part_of_speech: 'verbo' },
          'pogadać': { meaning: 'Charlar informalmente', part_of_speech: 'verbo' }
        }
      };
    } else if (targetLang === 'zh') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: '你好！很高兴和你练习中文。你想聊些什么呢？',
        translation: '¡Hola! Qué gusto practicar chino contigo. ¿De qué te gustaría hablar?',
        tokens: [
          { word: '你好！', translit: 'nǐ hǎo!', clean_word: '你好' },
          { word: '很高兴', translit: 'hěn gāoxìng', clean_word: '高兴' },
          { word: '和你', translit: 'hé nǐ', clean_word: '你' },
          { word: '练习', translit: 'liànxí', clean_word: '练习' },
          { word: '中文。', translit: 'zhōngwén.', clean_word: '中文' },
          { word: '你想', translit: 'nǐ xiǎng', clean_word: '想' },
          { word: '聊些', translit: 'liáo xiē', clean_word: '聊' },
          { word: '什么呢？', translit: 'shénme ne?', clean_word: '什么' }
        ],
        vocabulary: {
          '你好': { meaning: 'Hola (saludo cordial común)', part_of_speech: 'saludo', translit: 'nǐ hǎo' },
          '高兴': { meaning: 'Contento, complacido o alegre', part_of_speech: 'adjetivo', translit: 'gāoxìng' },
          '练习': { meaning: 'Practicar o ejercitar una lengua o destreza', part_of_speech: 'verbo', translit: 'liànxí' },
          '中文': { meaning: 'Idioma chino mandarín', part_of_speech: 'sustantivo', translit: 'zhōngwén' }
        }
      };
    } else if (targetLang === 'ar') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'مَرْحَبًا بِكَ! أَنَا مُسْتَعِدٌّ لِمُمَارَسَةِ اللُّغَةِ الْعَرَبِيَّةِ مَعَكَ. كَيْفَ أُسَاعِدُكَ الْيَوْمَ؟',
        translation: '¡Bienvenido! Estoy listo para practicar el idioma árabe contigo. ¿Cómo te ayudo hoy?',
        tokens: [
          { word: 'مَرْحَبًا', translit: 'marḥaban', clean_word: 'مرحبا' },
          { word: 'بِكَ!', translit: 'bika!', clean_word: 'بك' },
          { word: 'أَنَا', translit: 'anā', clean_word: 'أنا' },
          { word: 'مُسْتَعِدٌّ', translit: 'musta‘iddun', clean_word: 'مستعد' },
          { word: 'لِمُمَارَسَةِ', translit: 'li-mumārasati', clean_word: 'لممارسة' },
          { word: 'اللُّغَةِ', translit: 'al-lughati', clean_word: 'اللغة' },
          { word: 'الْعَرَبِيَّةِ', translit: 'al-‘arabiyyah', clean_word: 'العربية' },
          { word: 'مَعَكَ.', translit: 'ma‘aka.', clean_word: 'معك' },
          { word: 'كَيْفَ', translit: 'kayfa', clean_word: 'كيف' },
          { word: 'أُسَاعِدُكَ', translit: 'usā‘iduka', clean_word: 'أساعدك' },
          { word: 'الْيَوْمَ؟', translit: 'al-yawma?', clean_word: 'اليوم' }
        ],
        vocabulary: {
          'مرحبا': { meaning: 'Hola / Bienvenido (saludo cordial)', part_of_speech: 'saludo', translit: 'marḥaban' },
          'مستعد': { meaning: 'Preparado o listo para una actividad', part_of_speech: 'adjetivo', translit: 'musta‘idd' },
          'أساعدك': { meaning: 'Te ayudo o te asisto', part_of_speech: 'verbo', translit: 'usā‘iduk' },
          'اليوم': { meaning: 'Hoy (el día de hoy)', part_of_speech: 'sustantivo / adverbio', translit: 'al-yawm' }
        }
      };
    } else if (targetLang === 'ru') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Привет! Я рад практиковать русский язык с тобой. О чём ты хочешь поговорить?',
        translation: '¡Hola! Me alegra practicar ruso contigo. ¿De qué quieres hablar?',
        tokens: [
          { word: 'Привет!', translit: 'Privet!', clean_word: 'привет' },
          { word: 'Я', translit: 'Ya', clean_word: 'я' },
          { word: 'рад', translit: 'rad', clean_word: 'рад' },
          { word: 'практиковать', translit: 'praktikovat', clean_word: 'практиковать' },
          { word: 'русский', translit: 'russkiy', clean_word: 'русский' },
          { word: 'язык', translit: 'yazyk', clean_word: 'язык' }
        ],
        vocabulary: {
          'привет': { meaning: 'Hola (saludo cordial e informal)', part_of_speech: 'saludo', translit: 'privet' },
          'рад': { meaning: 'Contento o complacido', part_of_speech: 'adjetivo breve', translit: 'rad' }
        }
      };
    } else if (targetLang === 'nl') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Hallo! Leuk om Nederlands met je te oefenen. Waar wil je het over hebben?',
        translation: '¡Hola! Qué bien practicar neerlandés contigo. ¿De qué quieres hablar?',
        tokens: [
          { word: 'Hallo!', translit: null, clean_word: 'hallo' },
          { word: 'Leuk', translit: null, clean_word: 'leuk' },
          { word: 'om', translit: null, clean_word: 'om' },
          { word: 'Nederlands', translit: null, clean_word: 'nederlands' },
          { word: 'te', translit: null, clean_word: 'te' },
          { word: 'oefenen.', translit: null, clean_word: 'oefenen' }
        ],
        vocabulary: {
          'leuk': { meaning: 'Agradable, divertido o simpático', part_of_speech: 'adjetivo' },
          'oefenen': { meaning: 'Practicar o ensayar', part_of_speech: 'verbo' }
        }
      };
    } else if (targetLang === 'de') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Hallo! Ich freue mich, mit dir Deutsch zu üben. Worüber möchtest du heute sprechen?',
        translation: '¡Hola! Me alegra practicar alemán contigo. ¿De qué te gustaría hablar hoy?',
        tokens: [
          { word: 'Hallo!', translit: null, clean_word: 'hallo' },
          { word: 'Ich', translit: null, clean_word: 'ich' },
          { word: 'freue', translit: null, clean_word: 'freue' },
          { word: 'mich,', translit: null, clean_word: 'mich' },
          { word: 'mit', translit: null, clean_word: 'mit' },
          { word: 'dir', translit: null, clean_word: 'dir' },
          { word: 'Deutsch', translit: null, clean_word: 'deutsch' },
          { word: 'zu', translit: null, clean_word: 'zu' },
          { word: 'üben.', translit: null, clean_word: 'üben' }
        ],
        vocabulary: {
          'freuen': { meaning: 'Alegrarse o sentir satisfacción', part_of_speech: 'verbo reflexivo' },
          'üben': { meaning: 'Practicar o ejercitarse', part_of_speech: 'verbo' }
        }
      };
    } else if (targetLang === 'fr') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Bonjour ! Je suis ravi de pratiquer le français avec toi. De quoi aimerais-tu parler ?',
        translation: '¡Hola! Estoy encantado de practicar francés contigo. ¿De qué te gustaría hablar?',
        tokens: [
          { word: 'Bonjour', translit: null, clean_word: 'bonjour' },
          { word: '!', translit: null, clean_word: '!' },
          { word: 'Je', translit: null, clean_word: 'je' },
          { word: 'suis', translit: null, clean_word: 'suis' },
          { word: 'ravi', translit: null, clean_word: 'ravi' },
          { word: 'de', translit: null, clean_word: 'de' },
          { word: 'pratiquer', translit: null, clean_word: 'pratiquer' }
        ],
        vocabulary: {
          'ravi': { meaning: 'Encantado o muy complacido', part_of_speech: 'adjectif' },
          'pratiquer': { meaning: 'Practicar una lengua', part_of_speech: 'verbe' }
        }
      };
    } else if (targetLang === 'it') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Ciao! Sono felice di fare conversazione in italiano con te. Di cosa vorresti parlare?',
        translation: '¡Hola! Me alegro de conversar en italiano contigo. ¿De qué te gustaría hablar?',
        tokens: [
          { word: 'Ciao!', translit: null, clean_word: 'ciao' },
          { word: 'Sono', translit: null, clean_word: 'sono' },
          { word: 'felice', translit: null, clean_word: 'felice' },
          { word: 'di', translit: null, clean_word: 'di' },
          { word: 'fare', translit: null, clean_word: 'fare' },
          { word: 'conversazione', translit: null, clean_word: 'conversazione' }
        ],
        vocabulary: {
          'felice': { meaning: 'Feliz o contento', part_of_speech: 'aggettivo' },
          'conversazione': { meaning: 'Plática o conversación', part_of_speech: 'sostantivo' }
        }
      };
    } else if (targetLang === 'es') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: '¡Hola! Qué alegría poder conversar contigo en español. ¿De qué te gustaría hablar hoy?',
        translation: 'Hello! What a joy to practice Spanish together. What would you like to talk about today?',
        tokens: [
          { word: '¡Hola!', translit: null, clean_word: 'hola' },
          { word: 'Qué', translit: null, clean_word: 'qué' },
          { word: 'alegría', translit: null, clean_word: 'alegría' },
          { word: 'conversar', translit: null, clean_word: 'conversar' }
        ],
        vocabulary: {
          'alegría': { meaning: 'Gozo o placer', part_of_speech: 'sustantivo' },
          'conversar': { meaning: 'Platicar o hablar mutuamente', part_of_speech: 'verbo' }
        }
      };
    } else if (targetLang === 'en') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: "Hello! I'm really excited to practice English with you today. What would you like to talk about?",
        translation: '¡Hola! Estoy muy emocionado de practicar inglés contigo hoy. ¿De qué te gustaría hablar?',
        tokens: [
          { word: 'Hello!', translit: null, clean_word: 'hello' },
          { word: 'excited', translit: null, clean_word: 'excited' },
          { word: 'practice', translit: null, clean_word: 'practice' }
        ],
        vocabulary: {
          'excited': { meaning: 'Emocionado / entusiasmado', part_of_speech: 'adjective' },
          'practice': { meaning: 'Practicar o ejercitar', part_of_speech: 'verb' }
        }
      };
    } else if (targetLang === 'nl') {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Hallo! Wat leuk om samen Nederlands te oefenen. Hoe gaat het met jou vandaag?',
        translation: '¡Hola! Qué lindo practicar holandés juntos. ¿Cómo estás hoy?',
        tokens: [
          { word: 'Hallo!', translit: null, clean_word: 'hallo' },
          { word: 'Wat', translit: null, clean_word: 'wat' },
          { word: 'leuk', translit: null, clean_word: 'leuk' },
          { word: 'oefenen', translit: null, clean_word: 'oefenen' }
        ],
        vocabulary: {
          'oefenen': { meaning: 'Practicar o ejercitar', part_of_speech: 'werkwoord' },
          'leuk': { meaning: 'Lindo o agradable', part_of_speech: 'adjectief' }
        }
      };
    } else {
      initialBotMsg = {
        id: 'msg-init',
        sender: 'bot',
        text: 'Hello! I am ready to practice conversation with you. What would you like to chat about?',
        translation: '¡Hola! Estoy listo para practicar conversación contigo. ¿De qué te gustaría hablar?',
        tokens: [
          { word: 'Hello!', clean_word: 'hello', translit: null },
          { word: 'ready', clean_word: 'ready', translit: null }
        ],
        vocabulary: {
          'ready': { meaning: 'Listo o preparado', part_of_speech: 'adjective' }
        }
      };
    }
    return JSON.parse(JSON.stringify(initialBotMsg));
  }

  // Persist messages whenever conversation changes for current language
  useEffect(() => {
    if (activeLangRef.current === targetLang && messages && messages.length > 0) {
      saveChatToStorage(targetLang, messages);
    }
  }, [messages, targetLang]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isProcessing]);

  // Send message flow
  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || isProcessing) return;

    const tempUserId = `user-${Date.now()}`;
    const rawUserMsg = {
      id: tempUserId,
      sender: 'user',
      text: text.trim(),
      originalText: text.trim(),
      correctedText: text.trim(),
      hasCorrection: false,
      diffTokens: [{ text: text.trim(), changed: false, original: null }]
    };

    setMessages(prev => [...prev, rawUserMsg]);
    setIsProcessing(true);

    try {
      const result = await sendChatMessage({
        message: text.trim(),
        targetLang,
        nativeLang,
        level: config.level,
        apiKey: config.apiKey,
        provider: config.provider || 'groq',
        history: messages.slice(-6)
      });

      if (result && result.data && result.data.bot_response) {
        setApiWarning(null);
        const { user_correction, bot_response } = result.data;

        // Update user message with corrected text and amber-gold diffs
        setMessages(prev =>
          prev.map(m => {
            if (m.id === tempUserId) {
              return {
                ...m,
                originalText: text.trim(),
                correctedText: user_correction.corrected_text || m.text,
                hasCorrection: user_correction.has_errors || user_correction.diff_tokens?.some(t => t.changed),
                diffTokens: user_correction.diff_tokens || m.diffTokens
              };
            }
            return m;
          })
        );

        // Append bot response (exclusively generated by Groq AI)
        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: bot_response.text,
          translation: bot_response.translation,
          tokens: bot_response.tokens,
          vocabulary: bot_response.vocabulary
        };

        setMessages(prev => [...prev, botMsg]);

        // Auto-speak if autoPlayAi or hands-free is enabled (runs only once per bot message)
        if ((autoPlayAi || handsFree) && bot_response.text) {
          if (!playedBotMsgIdsRef.current.has(botMsg.id)) {
            playedBotMsgIdsRef.current.add(botMsg.id);
            speakText(bot_response.text, currentLangObj.speechCode, speechRate);
          }
        }
      }
    } catch (err) {
      console.warn('Chat service notice:', err.message);
      setApiWarning(err.message || 'Error al comunicarse con el servidor de Groq AI.');

      // Retain pedagogical feedback: update user message with deterministic correction if available
      if (err.user_correction) {
        const cor = err.user_correction;
        setMessages(prev =>
          prev.map(m => {
            if (m.id === tempUserId) {
              return {
                ...m,
                originalText: text.trim(),
                correctedText: cor.corrected_text || m.text,
                hasCorrection: cor.has_errors || cor.diff_tokens?.some(t => t.changed),
                diffTokens: cor.diff_tokens || m.diffTokens
              };
            }
            return m;
          })
        );
      }
      // ZERO canned/fake bot replies appended
    } finally {
      setIsProcessing(false);
    }
  };

  // Word lookup on-click
  const handleWordClick = async (word, vocabItem) => {
    if (vocabItem) {
      setSelectedWord({
        word,
        meaning: vocabItem.meaning,
        part_of_speech: vocabItem.part_of_speech,
        translit: vocabItem.translit
      });
      return;
    }

    try {
      const lookupResult = await lookupWordApi(word, targetLang, nativeLang, config.apiKey, config.provider || 'groq');
      if (lookupResult) {
        setSelectedWord(lookupResult);
        return;
      }
    } catch (err) {
      console.warn('Word lookup fallback:', err);
    }

    setSelectedWord({
      word,
      meaning: `Término en ${currentLangObj.name}: "${word}".`,
      part_of_speech: 'término',
      translit: null
    });
  };

  // Play audio helper
  const handlePlayAudio = (textToSpeak) => {
    speakText(textToSpeak, currentLangObj.speechCode, speechRate);
  };

  // Pronounce single word helper (normal or slow)
  const handlePronounceWord = (word, rate = 1.0) => {
    speakText(word, currentLangObj.speechCode, rate);
  };

  // Reset conversation for CURRENT language only
  const handleResetChat = () => {
    const initialMsg = getInitialBotMsg(targetLang);
    setMessages([initialMsg]);
    saveChatToStorage(targetLang, [initialMsg]);
    stopSpeaking();
  };

  return (
    <div className="flex flex-col h-screen font-sans text-[var(--text-primary)] transition-colors">
      {/* Header */}
      <Header
        languages={languages}
        targetLang={targetLang}
        setTargetLang={handleTargetLangChange}
        nativeLang={nativeLang}
        setNativeLang={handleNativeLangChange}
        showTransliteration={showTransliteration}
        setShowTransliteration={setShowTransliteration}
        handsFree={handsFree}
        setHandsFree={setHandsFree}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onResetChat={handleResetChat}
        isListening={isRecording}
        isSpeaking={isSpeaking}
        hasApiKey={Boolean(config?.apiKey)}
        apiWarning={apiWarning}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === 'home' ? (
        <HomePage
          onSelectMode={setActiveTab}
          targetLang={targetLang}
          setTargetLang={handleTargetLangChange}
          nativeLang={nativeLang}
          setNativeLang={handleNativeLangChange}
          languages={languages}
        />
      ) : activeTab === 'youtube' ? (
        <main className="flex-1 overflow-hidden w-full flex flex-col min-h-0">
          <YouTubeReaderPage targetLang={targetLang} nativeLang={nativeLang} apiKey={config?.apiKey} />
        </main>
      ) : activeTab === 'text' ? (
        <main className="flex-1 overflow-hidden w-full flex flex-col min-h-0">
          <TextReaderPage
            targetLang={targetLang}
            setTargetLang={handleTargetLangChange}
            nativeLang={nativeLang}
            languages={languages}
            apiKey={config?.apiKey}
            onWordClick={handleWordClick}
          />
        </main>
      ) : (
        <>
          {/* Main Chat Scroll Area */}
          <main
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto"
          >
            {/* API Error Warning Banner */}
            {apiWarning && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs flex items-center justify-between shadow-lg shadow-black/30 animate-fade-in">
                <div className="flex items-start space-x-2.5">
                  <span className="text-base leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="font-bold text-amber-100">
                      Aviso de Groq AI: {apiWarning}
                    </p>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      Haz clic en{' '}
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="underline font-bold text-white hover:text-amber-300"
                      >
                        Ajustes ⚙️
                      </button>{' '}
                      para verificar el estado del backend y la configuración de GROQ_API_KEY.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setApiWarning(null)}
                  className="p-1 text-amber-300/70 hover:text-white rounded-lg transition-colors flex-shrink-0 ml-2"
                  title="Cerrar aviso"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Helper Banner on top in Chocolate & Rose theme */}
            <div className="mb-6 p-4 rounded-2xl bg-[#32170f]/90 border border-[#52271a] shadow-md shadow-black/30 flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-md shadow-rose-950 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-rose-200">
                    {t('practicing_banner_title', { lang: currentLangObj.name })}
                  </h2>
                  {isSpanish ? (
                    <p className="text-xs text-rose-100/70 mt-0.5 leading-relaxed">
                      Habla o escribe con total libertad. Cada mensaje se analiza y corrige dinámicamente con las palabras modificadas con fuente en <span className="text-amber-300 font-extrabold underline decoration-amber-400/60 decoration-2 underline-offset-2">dorado</span>.
                    </p>
                  ) : (
                    <p className="text-xs text-rose-100/70 mt-0.5 leading-relaxed">
                      Speak or write freely. Every message is dynamically analyzed and corrected with modified words highlighted in <span className="text-amber-300 font-extrabold underline decoration-amber-400/60 decoration-2 underline-offset-2">gold</span>.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleResetChat}
                title={t('restart_tooltip')}
                className="p-1.5 text-rose-300/50 hover:text-rose-200 hover:bg-[#482216] rounded-lg transition-colors flex-shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Message Bubbles */}
            {messages.filter(Boolean).map((msg) => (
              <ChatMessage
                key={msg.id || `msg-${Math.random()}`}
                message={msg}
                targetLang={targetLang}
                nativeLang={nativeLang}
                showTransliteration={showTransliteration}
                onWordClick={handleWordClick}
                onPlayAudio={handlePlayAudio}
                isAudioPlaying={isSpeaking}
                onOpenGrammarBreakdown={handleOpenGrammarBreakdown}
                onDeleteMessage={handleDeleteMessage}
              />
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center space-x-2 my-4 px-2 animate-fade-in text-xs text-rose-300/60">
                <div className="w-4 h-4 rounded-full bg-rose-500 animate-pulse flex items-center justify-center text-[9px] text-white font-bold shadow-xs">
                  L
                </div>
                <span className="font-medium">{t('bot_thinking')}</span>
              </div>
            )}
          </main>

          {/* Input Bar */}
          <InputBar
            targetLang={targetLang}
            nativeLang={nativeLang}
            onSendMessage={handleSendMessage}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            isTranscribingAudio={isTranscribingAudio}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelRecording={cancelRecording}
            interimTranscript={interimTranscript}
            isProcessing={isProcessing}
          />
        </>
      )}

      {/* Word Definition Modal */}
      <WordModal
        wordData={selectedWord}
        onClose={() => setSelectedWord(null)}
        onPronounceWord={handlePronounceWord}
      />

      {/* Sentence Grammar Breakdown Modal */}
      <GrammarBreakdownModal
        isOpen={Boolean(breakdownData)}
        onClose={() => setBreakdownData(null)}
        sentenceBreakdown={breakdownData?.breakdown || []}
        originalText={breakdownData?.originalText || ''}
        correctedText={breakdownData?.correctedText || ''}
        targetLang={targetLang}
        onPronounceWord={(word) => speakText(word, currentLangObj.speechCode, speechRate)}
        isLoading={isBreakdownLoading}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
