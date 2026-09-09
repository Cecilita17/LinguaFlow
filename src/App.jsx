import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { WordModal } from './components/WordModal';
import { InputBar } from './components/InputBar';
import { SettingsModal } from './components/SettingsModal';
import { useSpeech } from './hooks/useSpeech';
import { Sparkles, RotateCcw } from 'lucide-react';
import { API_BASE_URL, sendChatMessage, lookupWordApi, fetchLanguagesApi } from './services/chatService';

const SUPPORTED_LANGUAGES = [
  { code: 'ar', name: 'Árabe', speechCode: 'ar-SA', hasTranslit: true, translitName: 'Romanización', rtl: true },
  { code: 'zh', name: 'Chino Mandarín', speechCode: 'zh-CN', hasTranslit: true, translitName: 'Pinyin' },
  { code: 'pl', name: 'Polaco', speechCode: 'pl-PL', hasTranslit: false },
  { code: 'ru', name: 'Ruso', speechCode: 'ru-RU', hasTranslit: true, translitName: 'Romanización' },
  { code: 'nl', name: 'Nederlands', speechCode: 'nl-NL', hasTranslit: false },
  { code: 'de', name: 'Alemán', speechCode: 'de-DE', hasTranslit: false },
  { code: 'fr', name: 'Francés', speechCode: 'fr-FR', hasTranslit: false },
  { code: 'it', name: 'Italiano', speechCode: 'it-IT', hasTranslit: false }
];

export default function App() {
  const [languages, setLanguages] = useState(SUPPORTED_LANGUAGES);
  const [targetLang, setTargetLang] = useState('pl'); // Default to Polish as requested

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
  const [nativeLang, setNativeLang] = useState('es');
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('linguaflow_config');
    return saved ? JSON.parse(saved) : { apiKey: '', level: 'A2/B1', speechRate: 0.95 };
  });

  const chatContainerRef = useRef(null);
  const currentLangObj = languages.find(l => l.code === targetLang) || languages[0];

  // Speech Hook
  const {
    isListening,
    isSpeaking,
    interimTranscript,
    startListening,
    stopListening,
    speakText,
    stopSpeaking
  } = useSpeech({
    targetLangCode: currentLangObj.speechCode,
    handsFree,
    isProcessing,
    onSpeechResult: (spokenText) => {
      handleSendMessage(spokenText);
    }
  });

  // Save config
  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('linguaflow_config', JSON.stringify(newConfig));
  };

  // Set initial greeting when target language changes
  useEffect(() => {
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
    }

    setMessages([initialBotMsg]);
  }, [targetLang]);

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
        history: messages.slice(-6)
      });

      if (result && result.data) {
        const { user_correction, bot_response } = result.data;

        // Update user message with corrected text and amber-gold diffs
        setMessages(prev =>
          prev.map(m => {
            if (m.id === tempUserId) {
              return {
                ...m,
                correctedText: user_correction.corrected_text || m.text,
                hasCorrection: user_correction.has_errors,
                diffTokens: user_correction.diff_tokens || m.diffTokens
              };
            }
            return m;
          })
        );

        // Append bot response
        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: bot_response.text,
          translation: bot_response.translation,
          tokens: bot_response.tokens,
          vocabulary: bot_response.vocabulary
        };

        setMessages(prev => [...prev, botMsg]);

        // Auto-speak if hands-free is enabled
        if (handsFree) {
          speakText(bot_response.text, currentLangObj.speechCode, config.speechRate);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: '¡Muy bien! Sigamos conversando.',
            translation: '¡Muy bien! Sigamos conversando.'
          }
        ]);
      }
    } catch (err) {
      console.error('Error in send message:', err);
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
      const lookupResult = await lookupWordApi(word, targetLang, nativeLang, config.apiKey);
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
    speakText(textToSpeak, currentLangObj.speechCode, config.speechRate);
  };

  // Pronounce single word helper (normal or slow)
  const handlePronounceWord = (word, rate = 1.0) => {
    speakText(word, currentLangObj.speechCode, rate);
  };

  // Reset conversation
  const handleResetChat = () => {
    setMessages([]);
    stopSpeaking();
    stopListening();
    setTargetLang(prev => prev);
  };

  return (
    <div className="flex flex-col h-screen font-sans text-stone-100 transition-colors">
      {/* Header */}
      <Header
        languages={languages}
        targetLang={targetLang}
        setTargetLang={setTargetLang}
        nativeLang={nativeLang}
        setNativeLang={setNativeLang}
        showTransliteration={showTransliteration}
        setShowTransliteration={setShowTransliteration}
        handsFree={handsFree}
        setHandsFree={setHandsFree}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isListening={isListening}
        isSpeaking={isSpeaking}
      />

      {/* Main Chat Scroll Area */}
      <main
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto"
      >
        {/* Helper Banner on top in Chocolate & Rose theme */}
        <div className="mb-6 p-4 rounded-2xl bg-[#32170f]/90 border border-[#52271a] shadow-md shadow-black/30 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-md shadow-rose-950 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-200">
                Practicando {currentLangObj.name} con LinguaFlow
              </h2>
              <p className="text-xs text-rose-100/70 mt-0.5 leading-relaxed">
                Habla o escribe con total libertad. Cada mensaje se analiza y corrige dinámicamente con las palabras modificadas con fuente en <span className="text-amber-300 font-extrabold underline decoration-amber-400/60 decoration-2 underline-offset-2">dorado</span>.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetChat}
            title="Reiniciar chat"
            className="p-1.5 text-rose-300/50 hover:text-rose-200 hover:bg-[#482216] rounded-lg transition-colors flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Message Bubbles */}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            targetLang={targetLang}
            showTransliteration={showTransliteration}
            onWordClick={handleWordClick}
            onPlayAudio={handlePlayAudio}
            isAudioPlaying={isSpeaking}
          />
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center space-x-2 my-4 px-2 animate-fade-in text-xs text-rose-300/60">
            <div className="w-4 h-4 rounded-full bg-rose-500 animate-pulse flex items-center justify-center text-[9px] text-white font-bold shadow-xs">
              L
            </div>
            <span className="font-medium">LinguaBot está analizando y respondiendo...</span>
          </div>
        )}
      </main>

      {/* Input Bar */}
      <InputBar
        targetLang={targetLang}
        onSendMessage={handleSendMessage}
        isListening={isListening}
        isSpeaking={isSpeaking}
        onStartListening={startListening}
        onStopListening={stopListening}
        handsFree={handsFree}
        interimTranscript={interimTranscript}
        isProcessing={isProcessing}
      />

      {/* Word Definition Modal */}
      <WordModal
        wordData={selectedWord}
        onClose={() => setSelectedWord(null)}
        onPronounceWord={handlePronounceWord}
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
