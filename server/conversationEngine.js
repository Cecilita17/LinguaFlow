import { computeWordDiff } from './languageData.js';

/**
 * Grammar error correction rules per language
 */
/**
 * Comprehensive Grammar Error Correction Rules per Language
 */
const GRAMMAR_RULES = {
  pl: [
    // Idioms & Sleep
    { regex: /\bja\s+(mieć|miec)\s+(sen|senność|sennosc)\b/gi, replacement: 'chce mi się spać' },
    { regex: /\b(mam|mieć|miec)\s+sen\b/gi, replacement: 'chce mi się spać' },
    { regex: /\b(jestem|być|byc)\s+sen(ny|na)\b/gi, replacement: 'jestem senny' },
    // Polish verb forms & pronouns
    { regex: /\bja\s+(być|byc|jest|są|sa)\b/gi, replacement: 'jestem' },
    { regex: /\bja\s+(mieć|miec|ma|mają|maja)\b/gi, replacement: 'mam' },
    { regex: /\bja\s+(chcieć|chciec|chce|chcą|chca)\b/gi, replacement: 'chcę' },
    { regex: /\bja\s+(iść|isc|idzie|idą|ida)\b/gi, replacement: 'idę' },
    { regex: /\bja\s+(lubić|lubic|lubi|lubią|lubia)\b/gi, replacement: 'lubię' },
    { regex: /\bja\s+(pić|pic|pije|piją|pija)\b/gi, replacement: 'piję' },
    { regex: /\bja\s+(robić|robic|robi|robią|robia)\b/gi, replacement: 'robię' },
    { regex: /\bja\s+(mówić|mowic|mowi|mówią|mowia)\b/gi, replacement: 'mówię' },
    { regex: /\bja\s+(wiedzieć|wiedziec|wie|wiedzą|wiedza)\b/gi, replacement: 'wiem' },
    { regex: /\bja\s+jestem\b/gi, replacement: 'jestem' },
    { regex: /\bja\s+chcę\b/gi, replacement: 'chcę' },
    { regex: /\bja\s+lubię\b/gi, replacement: 'lubię' },
    { regex: /\bja\s+mam\b/gi, replacement: 'mam' },
    // Accusative object cases
    { regex: /\b(chcę|chce|piję|pije|pić|pic|lubię|lubie)\s+kawa\b/gi, replacement: '$1 kawę' },
    { regex: /\b(chcę|chce|piję|pije|pić|pic|lubię|lubie)\s+kawe\b/gi, replacement: '$1 kawę' },
    { regex: /\b(chcę|chce|piję|pije|pić|pic|lubię|lubie)\s+herbata\b/gi, replacement: '$1 herbatę' },
    { regex: /\b(chcę|chce|piję|pije|pić|pic|lubię|lubie)\s+woda\b/gi, replacement: '$1 wodę' },
    { regex: /\b(chcę|chce|piję|pije|pić|pic|lubię|lubie)\s+wode\b/gi, replacement: '$1 wodę' },
    { regex: /\b(mam|mieć|miec)\s+pies\b/gi, replacement: 'mam psa' },
    { regex: /\b(mam|mieć|miec)\s+kot\b/gi, replacement: 'mam kota' },
    // Frequent typos without diacritics
    { regex: /\bczesc\b/gi, replacement: 'cześć' },
    { regex: /\bdzien\s+dobry\b/gi, replacement: 'dzień dobry' },
    { regex: /\bdziekuje\b/gi, replacement: 'dziękuję' },
    { regex: /\bprosze\b/gi, replacement: 'proszę' },
    { regex: /\bjak\s+sie\s+masz\b/gi, replacement: 'jak się masz' },
    // Spanish phrases to Polish
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: 'Cześć!' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: 'Chce mi się spać' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'Poproszę kawę' },
    { regex: /\b(gracias)\b/gi, replacement: 'Dziękuję!' }
  ],
  ar: [
    { regex: /[أا]نا\s+نوم/g, replacement: 'أَنَا نَعْسَانُ' },
    { regex: /[أا]نا\s+[يأا]ريد/g, replacement: 'أَنَا أُرِيدُ' },
    { regex: /[أا]نا\s+[يأا]شرب/g, replacement: 'أَنَا أَشْرَبُ' },
    { regex: /[أا]ريد\s+قهو[ةه]/g, replacement: 'أُرِيدُ قَهْوَةً' },
    { regex: /[أا]ريد\s+ما[ءء]/g, replacement: 'أُرِيدُ مَاءً' },
    { regex: /كيف\s+حال/g, replacement: 'كَيْفَ حَالُكَ؟' },
    { regex: /صباح\s+خير/g, replacement: 'صَبَاحُ الخَيْرِ' },
    { regex: /مساء\s+خير/g, replacement: 'مَسَاءُ الخَيْرِ' },
    { regex: /\b(hola)\b/gi, replacement: 'مَرْحَبًا!' }
  ],
  zh: [
    { regex: /我困/g, replacement: '我很困' },
    { regex: /我睡觉/g, replacement: '我想去睡觉' },
    { regex: /我喝咖啡/g, replacement: '我想喝杯咖啡' },
    { regex: /你好吗/g, replacement: '你好，最近怎么样？' },
    { regex: /\b(hola)\b/gi, replacement: '你好！' }
  ],
  ru: [
    { regex: /\bя\s+хотеть\s+спать\b/gi, replacement: 'я хочу спать' },
    { regex: /\bя\s+иметь\s+спать\b/gi, replacement: 'я хочу спать' },
    { regex: /\bя\s+хотеть\b/gi, replacement: 'я хочу' },
    { regex: /\bя\s+идти\b/gi, replacement: 'я иду' },
    { regex: /\bя\s+пить\b/gi, replacement: 'я пью' },
    { regex: /\bя\s+любить\b/gi, replacement: 'я люблю' },
    { regex: /\b(hola)\b/gi, replacement: 'Привет!' }
  ],
  nl: [
    { regex: /\bik\s+heb\s+moe\b/gi, replacement: 'ik ben moe' },
    { regex: /\bik\s+ben\s+slaap\b/gi, replacement: 'ik ben moe' },
    { regex: /\bik\s+ben\s+honger\b/gi, replacement: 'ik heb honger' },
    { regex: /\bik\s+ben\s+dorst\b/gi, replacement: 'ik heb dorst' },
    { regex: /\bik\s+(zijn|is|bent)\b/gi, replacement: 'ik ben' },
    { regex: /\bik\s+(hebben|heeft)\b/gi, replacement: 'ik heb' },
    { regex: /\bik\s+willen\b/gi, replacement: 'ik wil' },
    { regex: /\bik\s+gaan\b/gi, replacement: 'ik ga' },
    { regex: /\bmaaken\b/gi, replacement: 'maken' },
    { regex: /\bneemen\b/gi, replacement: 'nemen' },
    { regex: /\bspreeken\b/gi, replacement: 'spreken' },
    { regex: /\bkoopen\b/gi, replacement: 'kopen' },
    { regex: /\bloopen\b/gi, replacement: 'lopen' },
    { regex: /\bwoonen\b/gi, replacement: 'wonen' },
    { regex: /\bzeegen\b/gi, replacement: 'zeggen' },
    { regex: /\bgeeven\b/gi, replacement: 'geven' },
    { regex: /\bleesen\b/gi, replacement: 'lezen' },
    { regex: /\bik\s+komt\b/gi, replacement: 'ik kom' },
    { regex: /\bik\s+werkt\b/gi, replacement: 'ik werk' }
  ],
  de: [
    { regex: /\bich\s+(habe|bin)\s+schlaf\b/gi, replacement: 'ich bin müde' },
    { regex: /\bich\s+bin\s+durst(ig)?\b/gi, replacement: 'ich habe Durst' },
    { regex: /\bich\s+bin\s+hunger\b/gi, replacement: 'ich habe Hunger' },
    { regex: /\bich\s+(sein|bist|ist)\b/gi, replacement: 'ich bin' },
    { regex: /\bich\s+(haben|hat)\b/gi, replacement: 'ich habe' },
    { regex: /\bich\s+wollen\b/gi, replacement: 'ich will' },
    { regex: /\bich\s+gehen\b/gi, replacement: 'ich gehe' },
    { regex: /\bich\s+trinken\b/gi, replacement: 'ich trinke' },
    { regex: /\bein\s+kaffee\b/gi, replacement: 'einen Kaffee' }
  ],
  fr: [
    { regex: /\bje\s+suis\s+faim\b/gi, replacement: "j'ai faim" },
    { regex: /\bje\s+suis\s+soif\b/gi, replacement: "j'ai soif" },
    { regex: /\bje\s+suis\s+sommeil\b/gi, replacement: "j'ai sommeil" },
    { regex: /\bje\s+suis\s+chaud\b/gi, replacement: "j'ai chaud" },
    { regex: /\bje\s+suis\s+froid\b/gi, replacement: "j'ai froid" },
    { regex: /\bje\s+(aller|va)\b/gi, replacement: 'je vais' },
    { regex: /\bje\s+vouloir\b/gi, replacement: 'je veux' },
    { regex: /\bje\s+avoir\b/gi, replacement: "j'ai" },
    { regex: /\bje\s+(être|es|est)\b/gi, replacement: 'je suis' },
    { regex: /\bje\s+faire\b/gi, replacement: 'je fais' },
    { regex: /\bun\s+cafe\b/gi, replacement: 'un café' },
    { regex: /\bje\s+veux\s+un\s+cafe\b/gi, replacement: 'je voudrais un café' }
  ],
  it: [
    { regex: /\bio\s+(avere|ho)\s+fame\b/gi, replacement: 'ho fame' },
    { regex: /\bio\s+(avere|ho)\s+sete\b/gi, replacement: 'ho sete' },
    { regex: /\bio\s+(avere|ho)\s+sonno\b/gi, replacement: 'ho sonno' },
    { regex: /\bio\s+(essere|è|sei)\b/gi, replacement: 'sono' },
    { regex: /\bio\s+(andare|va)\b/gi, replacement: 'vado' },
    { regex: /\bio\s+(volere|vuole)\b/gi, replacement: 'voglio' },
    { regex: /\bun\s+caffe\b/gi, replacement: 'un caffè' },
    { regex: /\bio\s+voglio\s+un\s+caff[eè]\b/gi, replacement: 'vorrei un caffè' }
  ],
  es: [
    { regex: /\byo\s+(tener|tengo)\s+sue[nñ]o\b/gi, replacement: 'tengo sueño' },
    { regex: /\byo\s+(tener)\s+hambre\b/gi, replacement: 'tengo hambre' },
    { regex: /\byo\s+(ser|es)\s+cansad[oa]\b/gi, replacement: 'estoy cansado' },
    { regex: /\byo\s+(ser)\s+estudiante\b/gi, replacement: 'soy estudiante' },
    { regex: /\byo\s+(tener)\s+(\d+)\s+a[nñ]os\b/gi, replacement: 'tengo $2 años' },
    { regex: /\byo\s+(ir)\s+a\b/gi, replacement: 'voy a' },
    { regex: /\byo\s+(querer)\b/gi, replacement: 'quiero' },
    { regex: /\b(tambien)\b/gi, replacement: 'también' },
    { regex: /\b(ingles)\b/gi, replacement: 'inglés' },
    { regex: /\b(frances)\b/gi, replacement: 'francés' },
    { regex: /\b(cafe)\b/gi, replacement: 'café' },
    { regex: /\b(cancion)\b/gi, replacement: 'canción' },
    { regex: /\b(facil)\b/gi, replacement: 'fácil' },
    { regex: /\b(dificil)\b/gi, replacement: 'difícil' },
    { regex: /\b(adios)\b/gi, replacement: 'adiós' },
    { regex: /\b(como\s+estas)\b/gi, replacement: '¿cómo estás?' },
    { regex: /\b(que\s+tal)\b/gi, replacement: '¿qué tal?' },
    { regex: /\blas\s+casa\b/gi, replacement: 'las casas' },
    { regex: /\blos\s+amigo\b/gi, replacement: 'los amigos' }
  ],
  en: [
    { regex: /\b(he|she|it)\s+(have)\b/gi, replacement: '$1 has' },
    { regex: /\b(he|she|it)\s+(do)\b/gi, replacement: '$1 does' },
    { regex: /\b(he|she|it)\s+(go)\b/gi, replacement: '$1 goes' },
    { regex: /\b(he|she|it)\s+(want)\b/gi, replacement: '$1 wants' },
    { regex: /\b(he|she|it)\s+(like)\b/gi, replacement: '$1 likes' },
    { regex: /\b(they|we|you)\s+(is)\b/gi, replacement: '$1 are' },
    { regex: /\b(they|we|you)\s+(was)\b/gi, replacement: '$1 were' },
    { regex: /\bi\s+(is|are)\b/gi, replacement: 'I am' },
    { regex: /\bi\s+(has)\b/gi, replacement: 'I have' },
    { regex: /\bi\b/g, replacement: 'I' },
    { regex: /\ba\s+([aeiou]\w+)\b/gi, replacement: 'an $1' },
    { regex: /\b(dont)\b/gi, replacement: "don't" },
    { regex: /\b(doesnt)\b/gi, replacement: "doesn't" },
    { regex: /\b(cant)\b/gi, replacement: "can't" },
    { regex: /\b(im)\b/gi, replacement: "I'm" },
    { regex: /\b(goed)\b/gi, replacement: 'went' },
    { regex: /\b(buyed)\b/gi, replacement: 'bought' }
  ]
};

/**
 * Multi-turn dialogue topics per language
 */
const CONVERSATION_TOPICS = {
  pl: [
    {
      id: 'pl_spack',
      triggers: ['spać', 'spac', 'senny', 'zmęczony', 'zmeczony', 'zmęczenie'],
      response: 'Rozumiem! Miałeś długi dzień. Połóż się wcześniej i odpocznij. Jak minął twój dzień?',
      translation: '¡Lo entiendo! Tuviste un día largo. Acuéstate temprano y descansa. ¿Cómo estuvo tu día?',
      tokens: [
        { word: 'Rozumiem!', clean_word: 'rozumiem', translit: null },
        { word: 'Miałeś', clean_word: 'miałeś', translit: null },
        { word: 'długi', clean_word: 'długi', translit: null },
        { word: 'dzień.', clean_word: 'dzień', translit: null },
        { word: 'Połóż', clean_word: 'połóż', translit: null },
        { word: 'się', clean_word: 'się', translit: null },
        { word: 'wcześniej', clean_word: 'wcześniej', translit: null },
        { word: 'i', clean_word: 'i', translit: null },
        { word: 'odpocznij.', clean_word: 'odpocznij', translit: null }
      ],
      vocabulary: {
        'rozumiem': { meaning: 'Comprendo o entiendo', part_of_speech: 'verbo' },
        'odpocznij': { meaning: 'Descansa o toma reposo', part_of_speech: 'verbo (imperativo)' },
        'wcześniej': { meaning: 'Más temprano', part_of_speech: 'adverbio' }
      }
    },
    {
      id: 'pl_kawa',
      triggers: ['kawa', 'kawę', 'kawe', 'pić', 'pic', 'napój'],
      response: 'Świeża kawa zawsze pomaga! Wolisz kawę czarną, czy z mlekiem i odrobiną cukru?',
      translation: '¡El café fresco siempre ayuda! ¿Prefieres café negro, o con leche y un poco de azúcar?',
      tokens: [
        { word: 'Świeża', clean_word: 'świeża', translit: null },
        { word: 'kawa', clean_word: 'kawa', translit: null },
        { word: 'zawsze', clean_word: 'zawsze', translit: null },
        { word: 'pomaga!', clean_word: 'pomaga', translit: null },
        { word: 'Wolisz', clean_word: 'wolisz', translit: null },
        { word: 'kawę', clean_word: 'kawę', translit: null },
        { word: 'czarną,', clean_word: 'czarną', translit: null },
        { word: 'czy', clean_word: 'czy', translit: null },
        { word: 'z', clean_word: 'z', translit: null },
        { word: 'mlekiem?', clean_word: 'mlekiem', translit: null }
      ],
      vocabulary: {
        'kawa': { meaning: 'Café (bebida caliente)', part_of_speech: 'sustantivo' },
        'wolisz': { meaning: 'Prefieres (tú)', part_of_speech: 'verbo' },
        'mlekiem': { meaning: 'Con leche', part_of_speech: 'sustantivo instrumental' }
      }
    },
    {
      id: 'pl_mleko',
      triggers: ['mlekiem', 'mleko', 'cukrem', 'cukier', 'czarna'],
      response: 'To wyśmienite połączenie! Daje dużo energii. Jakie masz plany na dzisiejszy wieczór?',
      translation: '¡Es una combinación deliciosa! Aporta mucha energía. ¿Qué planes tienes para esta noche?',
      tokens: [
        { word: 'To', clean_word: 'to', translit: null },
        { word: 'wyśmienite', clean_word: 'wyśmienite', translit: null },
        { word: 'połączenie!', clean_word: 'połączenie', translit: null },
        { word: 'Jakie', clean_word: 'jakie', translit: null },
        { word: 'masz', clean_word: 'masz', translit: null },
        { word: 'plany', clean_word: 'plany', translit: null },
        { word: 'na', clean_word: 'na', translit: null },
        { word: 'dzisiaj?', clean_word: 'dzisiaj', translit: null }
      ],
      vocabulary: {
        'wyśmienite': { meaning: 'Excelente o delicioso', part_of_speech: 'adjetivo' },
        'plany': { meaning: 'Planes o proyectos', part_of_speech: 'sustantivo' }
      }
    }
  ],

  ar: [
    {
      id: 'ar_sueno',
      triggers: ['نوم', 'نعسان', 'تعبان', 'متعب'],
      response: 'أَفْهَمُكَ جَيِّدًا! خُذْ قِسْطًا مِنَ الرَّاحَةِ وَاشْرَبْ مَاءً دَافِئًا لِتَسْتَعِيدَ نَشَاطَكَ.',
      translation: '¡Te comprendo bien! Descansa un rato y toma agua tibia para recuperar tu energía.',
      tokens: [
        { word: 'أَفْهَمُكَ', clean_word: 'أفهمك', translit: 'afhamuka' },
        { word: 'جَيِّدًا!', clean_word: 'جيدا', translit: 'jayyidan!' },
        { word: 'خُذْ', clean_word: 'خذ', translit: 'khudh' },
        { word: 'قِسْطًا', clean_word: 'قسطا', translit: 'qistan' },
        { word: 'مِنَ', clean_word: 'من', translit: 'mina' },
        { word: 'الرَّاحَةِ.', clean_word: 'الراحة', translit: 'ar-rāḥati.' }
      ],
      vocabulary: {
        'الراحة': { meaning: 'El descanso o reposo', part_of_speech: 'sustantivo', translit: 'ar-rāḥah' },
        'أفهمك': { meaning: 'Te entiendo / te comprendo', part_of_speech: 'verbo', translit: 'afhamuka' }
      }
    },
    {
      id: 'ar_kahwa',
      triggers: ['قهوة', 'شاي', 'شرب', 'اشرب', 'قهوه'],
      response: 'الْقَهْوَةُ مَشْرُوبٌ رَائِعٌ لِبَدْءِ الْيَوْمِ! هَلْ تُفَضِّلُ الْقَهْوَةَ بِالْحَلِيبِ أَمْ سَادَةً؟',
      translation: '¡El café es una bebida maravillosa para empezar el día! ¿Prefieres el café con leche o solo?',
      tokens: [
        { word: 'الْقَهْوَةُ', clean_word: 'القهوة', translit: 'al-qahwatu' },
        { word: 'مَشْرُوبٌ', clean_word: 'مشروب', translit: 'mashrūbun' },
        { word: 'رَائِعٌ!', clean_word: 'رائع', translit: 'rā’i‘un!' },
        { word: 'هَلْ', clean_word: 'هل', translit: 'hal' },
        { word: 'تُفَضِّلُ', clean_word: 'تفضل', translit: 'tufaḍḍilu' },
        { word: 'الْحَلِيبِ؟', clean_word: 'الحليب', translit: 'al-ḥalībi?' }
      ],
      vocabulary: {
        'القهوة': { meaning: 'El café', part_of_speech: 'sustantivo', translit: 'al-qahwah' },
        'تفضل': { meaning: 'Prefieres (tú)', part_of_speech: 'verbo', translit: 'tufaḍḍil' }
      }
    }
  ],

  zh: [
    {
      id: 'zh_sueno',
      triggers: ['困', '睡觉', '累', 'kun', 'shuijiao'],
      response: '很累的话就早点休息吧！喝杯温水，今天晚上做个甜甜的好梦。',
      translation: '¡Si estás cansado descansa temprano! Bebe un vaso de agua tibia y que tengas dulces sueños esta noche.',
      tokens: [
        { word: '很累的', clean_word: '累', translit: 'hěn lèi de' },
        { word: '话就', clean_word: '话', translit: 'huà jiù' },
        { word: '早点休息', clean_word: '休息', translit: 'zǎodiǎn xiūxi' },
        { word: '做个好梦。', clean_word: '好梦', translit: 'zuò ge hǎomèng.' }
      ],
      vocabulary: {
        '早点休息': { meaning: 'Descansar temprano', part_of_speech: 'frase', translit: 'zǎodiǎn xiūxi' },
        '好梦': { meaning: 'Dulces sueños', part_of_speech: 'sustantivo compuesto', translit: 'hǎomèng' }
      }
    },
    {
      id: 'zh_kafei',
      triggers: ['咖啡', '喝', '茶', 'kafei'],
      response: '喝杯热咖啡确实很提神！你喜欢加牛奶还是直接喝纯黑咖啡呢？',
      translation: '¡Tomar una taza de café caliente realmente despierta! ¿Te gusta añadir leche o beberlo directamente solo?',
      tokens: [
        { word: '喝杯', clean_word: '喝', translit: 'hē bēi' },
        { word: '热咖啡', clean_word: '热咖啡', translit: 'rè kāfēi' },
        { word: '确实很', clean_word: '确实', translit: 'quèshí hěn' },
        { word: '提神！', clean_word: '提神', translit: 'tíshén!' },
        { word: '你喜欢', clean_word: '喜欢', translit: 'nǐ xǐhuan' },
        { word: '加牛奶吗？', clean_word: '牛奶', translit: 'jiā niúnǎi ma?' }
      ],
      vocabulary: {
        '热咖啡': { meaning: 'Café caliente', part_of_speech: 'sustantivo compuesto', translit: 'rè kāfēi' },
        '提神': { meaning: 'Despejar la mente / revitalizar', part_of_speech: 'verbo', translit: 'tíshén' }
      }
    }
  ],

  ru: [
    {
      id: 'ru_sueno',
      triggers: ['спать', 'устал', 'сон', 'устала', 'spat'],
      response: 'Понимаю тебя! Отдохни немного, выпей теплого чая и выспись как следует.',
      translation: '¡Te entiendo! Descansa un poco, toma té caliente y duerme bien.',
      tokens: [
        { word: 'Понимаю', clean_word: 'понимаю', translit: 'Ponimayu' },
        { word: 'тебя!', clean_word: 'тебя', translit: 'tebya!' },
        { word: 'Отдохни', clean_word: 'отдохни', translit: 'Otdokhni' },
        { word: 'немного,', clean_word: 'немного', translit: 'nemnogo,' },
        { word: 'выпей', clean_word: 'выпей', translit: 'vypey' },
        { word: 'чая.', clean_word: 'чая', translit: 'chaya.' }
      ],
      vocabulary: {
        'понимаю': { meaning: 'Comprendo o entiendo', part_of_speech: 'verbo', translit: 'ponimayu' },
        'отдохни': { meaning: 'Descansa', part_of_speech: 'verbo', translit: 'otdokhni' }
      }
    },
    {
      id: 'ru_kofe',
      triggers: ['кофе', 'чай', 'пить', 'kofe'],
      response: 'Чашка горячего кофе отлично помогает взбодриться! Ты любишь кофе с молоком?',
      translation: '¡Una taza de café caliente ayuda genial a despejarse! ¿Te gusta el café con leche?',
      tokens: [
        { word: 'Чашка', clean_word: 'чашка', translit: 'Chashka' },
        { word: 'кофе', clean_word: 'кофе', translit: 'kofe' },
        { word: 'отлично', clean_word: 'отлично', translit: 'otlichno' },
        { word: 'помогает!', clean_word: 'помогает', translit: 'pomogayet!' }
      ],
      vocabulary: {
        'кофе': { meaning: 'Café', part_of_speech: 'sustantivo', translit: 'kofe' }
      }
    }
  ],

  nl: [
    {
      id: 'nl_hoe_gaat_het',
      triggers: ['hoe gaat', 'hoe is het', 'alles goed', 'hoe maak je'],
      response: 'Met mij gaat het heel goed, dank je wel! En hoe is jouw dag tot nu toe?',
      translation: '¡Conmigo va muy bien, muchas gracias! ¿Y cómo ha estado tu día hasta ahora?',
      tokens: [
        { word: 'Met', clean_word: 'met', translit: null },
        { word: 'mij', clean_word: 'mij', translit: null },
        { word: 'gaat', clean_word: 'gaat', translit: null },
        { word: 'het', clean_word: 'het', translit: null },
        { word: 'goed!', clean_word: 'goed', translit: null }
      ],
      vocabulary: {
        'heel goed': { meaning: 'Muy bien', part_of_speech: 'adverbio' },
        'dag': { meaning: 'Día', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'nl_hallo',
      triggers: ['hallo', 'hoi', 'goedemorgen', 'goedemiddag', 'goedenavond'],
      response: 'Hallo! Wat leuk om je te spreken. Waar wil je vandaag over praten in het Nederlands?',
      translation: '¡Hola! Qué gusto hablar contigo. ¿De qué te gustaría hablar hoy en holandés?',
      tokens: [
        { word: 'Hallo!', clean_word: 'hallo', translit: null },
        { word: 'Wat', clean_word: 'wat', translit: null },
        { word: 'leuk', clean_word: 'leuk', translit: null }
      ],
      vocabulary: {
        'leuk': { meaning: 'Agradable, bonito o divertido', part_of_speech: 'adjetivo' }
      }
    },
    {
      id: 'nl_naam',
      triggers: ['ik heet', 'mijn naam is', 'ik ben'],
      response: 'Aangenaam kennis te maken! Heel fijn om samen te oefenen. Uit welk land of welke stad kom je?',
      translation: '¡Encantado de conocerte! Es muy grato practicar juntos. ¿De qué país o ciudad vienes?',
      tokens: [
        { word: 'Aangenaam', clean_word: 'aangenaam', translit: null },
        { word: 'kennis', clean_word: 'kennis', translit: null },
        { word: 'te', clean_word: 'te', translit: null },
        { word: 'maken!', clean_word: 'maken', translit: null }
      ],
      vocabulary: {
        'aangenaam': { meaning: 'Encantado / un placer', part_of_speech: 'adjetivo' }
      }
    },
    {
      id: 'nl_bedankt',
      triggers: ['bedankt', 'dank je', 'dank u', 'dankjewel'],
      response: 'Graag gedaan! Het is een waar genoegen om je te helpen. Wat wil je nog meer oefenen?',
      translation: '¡De nada! Es un verdadero placer ayudarte. ¿Qué más te gustaría practicar?',
      tokens: [
        { word: 'Graag', clean_word: 'graag', translit: null },
        { word: 'gedaan!', clean_word: 'gedaan', translit: null }
      ],
      vocabulary: {
        'graag gedaan': { meaning: 'De nada / con gusto', part_of_speech: 'expresión de cortesía' }
      }
    },
    {
      id: 'nl_slaap',
      triggers: ['moe', 'slaap', 'slapen', 'moeheid'],
      response: 'Wat vervelend dat je moe bent! Neem even een pauze en ga lekker vroeg slapen.',
      translation: '¡Qué lástima que estés cansado! Tómate un descanso y vete temprano a dormir.',
      tokens: [
        { word: 'Neem', clean_word: 'neem', translit: null },
        { word: 'even', clean_word: 'even', translit: null },
        { word: 'een', clean_word: 'een', translit: null },
        { word: 'pauze.', clean_word: 'pauze', translit: null }
      ],
      vocabulary: {
        'pauze': { meaning: 'Descanso o pausa', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'nl_koffie',
      triggers: ['koffie', 'thee', 'drinken'],
      response: 'Een kopje koffie doet altijd wonderen! Drink je het liefst zwarte koffie of met melk?',
      translation: '¡Una taza de café siempre hace maravillas! ¿Prefieres café negro o con leche?',
      tokens: [
        { word: 'Een', clean_word: 'een', translit: null },
        { word: 'kopje', clean_word: 'kopje', translit: null },
        { word: 'koffie!', clean_word: 'koffie', translit: null }
      ],
      vocabulary: {
        'koffie': { meaning: 'Café', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'nl_groentesoep',
      triggers: ['soep', 'groenten', 'groente'],
      response: 'Om groentesoep te maken, snijd je eerst groenten zoals wortel, prei en ui. Kook ze zachtjes in water met een bouillonblokje voor ongeveer twintig minuten. Wil je er ook soepballetjes of verse peterselie in?',
      translation: 'Para hacer sopa de verduras, primero corta verduras como zanahoria, puerro y cebolla. Hiérvelas a fuego lento en agua con un cubito de caldo durante unos veinte minutos. ¿Quieres añadirle albóndigas o perejil fresco?',
      tokens: [
        { word: 'Om', clean_word: 'om', translit: null },
        { word: 'groentesoep', clean_word: 'groentesoep', translit: null },
        { word: 'te', clean_word: 'te', translit: null },
        { word: 'maken,', clean_word: 'maken', translit: null },
        { word: 'snijd', clean_word: 'snijd', translit: null },
        { word: 'je', clean_word: 'je', translit: null },
        { word: 'eerst', clean_word: 'eerst', translit: null },
        { word: 'groenten', clean_word: 'groenten', translit: null },
        { word: 'zoals', clean_word: 'zoals', translit: null },
        { word: 'wortel,', clean_word: 'wortel', translit: null },
        { word: 'prei', clean_word: 'prei', translit: null },
        { word: 'en', clean_word: 'en', translit: null },
        { word: 'ui.', clean_word: 'ui', translit: null }
      ],
      vocabulary: {
        'groentesoep': { meaning: 'Sopa de verduras', part_of_speech: 'sustantivo' },
        'snijd': { meaning: 'Cortas o picas (del verbo snijden)', part_of_speech: 'verbo' },
        'koken': { meaning: 'Cocinar o hervir', part_of_speech: 'verbo' },
        'bouillonblokje': { meaning: 'Cubito de caldo concentrado', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'nl_koken',
      triggers: ['koken', 'eten', 'maaltijd', 'recept', 'lunch', 'diner', 'avondeten', 'ontbijt', 'bakken', 'vlees', 'vegetarisch'],
      response: 'Lekker eten klaarmaken is geweldig! Kook je het liefst volgens een vast recept of experimenteer je graag met kruiden?',
      translation: '¡Preparar comida rica es genial! ¿Prefieres cocinar según una receta fija o te gusta experimentar con especias?',
      tokens: [
        { word: 'Lekker', clean_word: 'lekker', translit: null },
        { word: 'eten', clean_word: 'eten', translit: null },
        { word: 'klaarmaken', clean_word: 'klaarmaken', translit: null },
        { word: 'is', clean_word: 'is', translit: null },
        { word: 'geweldig!', clean_word: 'geweldig', translit: null }
      ],
      vocabulary: {
        'klaarmaken': { meaning: 'Preparar o elaborar', part_of_speech: 'verbo' },
        'recept': { meaning: 'Receta de cocina', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'nl_hoe_kan_ik',
      triggers: ['hoe kan ik', 'hoe doe je', 'hoe maak je', 'hoe moet ik'],
      response: 'Een handige manier is om het stap voor stap aan te pakken. Zorg dat je alle spullen klaarzet en neem rustig de tijd. Welk onderdeel wil je als eerste proberen?',
      translation: 'Una manera práctica es abordarlo paso a paso. Asegúrate de tener todas las cosas listas y tómate tu tiempo. ¿Qué parte quieres intentar primero?',
      tokens: [
        { word: 'Stap', clean_word: 'stap', translit: null },
        { word: 'voor', clean_word: 'voor', translit: null },
        { word: 'stap!', clean_word: 'stap', translit: null }
      ],
      vocabulary: {
        'stap voor stap': { meaning: 'Paso a paso', part_of_speech: 'expresión adverbial' }
      }
    },
    {
      id: 'nl_weer',
      triggers: ['weer', 'regen', 'zon', 'koud', 'warm', 'zomer', 'winter', 'herfst', 'lente'],
      response: 'Het weer kan hier zo snel veranderen! Houd je meer van een warme zonnige middag of van knus binnenblijven als het regent?',
      translation: '¡El clima aquí puede cambiar tan rápido! ¿Prefieres una tarde cálida y soleada o quedarte acogedor adentro cuando llueve?',
      tokens: [
        { word: 'Het', clean_word: 'het', translit: null },
        { word: 'weer', clean_word: 'weer', translit: null }
      ],
      vocabulary: {
        'weer': { meaning: 'Tiempo o clima', part_of_speech: 'sustantivo' }
      }
    }
  ],

  de: [
    {
      id: 'de_muede',
      triggers: ['müde', 'muede', 'schlaf', 'schlafen'],
      response: 'Das kenne ich gut! Ruh dich ein bisschen aus oder trink ein Glas frisches Wasser.',
      translation: '¡Conozco bien esa sensación! Descansa un poco o bebe un vaso de agua fresca.',
      tokens: [
        { word: 'Ruh', clean_word: 'ruh', translit: null },
        { word: 'dich', clean_word: 'dich', translit: null },
        { word: 'aus!', clean_word: 'aus', translit: null }
      ],
      vocabulary: {
        'ausruhen': { meaning: 'Descansar o relajarse', part_of_speech: 'verbo' }
      }
    },
    {
      id: 'de_kaffee',
      triggers: ['kaffee', 'tee', 'trinken'],
      response: 'Frischer Kaffee hilft immer! Trinkst du ihn lieber schwarz oder mit viel Milch?',
      translation: '¡El café recién hecho siempre ayuda! ¿Lo bebes preferiblemente solo o con mucha leche?',
      tokens: [
        { word: 'Frischer', clean_word: 'frischer', translit: null },
        { word: 'Kaffee!', clean_word: 'kaffee', translit: null }
      ],
      vocabulary: {
        'kaffee': { meaning: 'Café', part_of_speech: 'sustantivo' }
      }
    }
  ],

  fr: [
    {
      id: 'fr_sommeil',
      triggers: ['sommeil', 'fatigué', 'fatigue', 'dormir'],
      response: 'Je te comprends ! Repose-toi un peu et prends un bon moment de calme.',
      translation: '¡Te comprendo! Descansa un poco y tómate un buen momento de tranquilidad.',
      tokens: [
        { word: 'Repose-toi', clean_word: 'repose-toi', translit: null },
        { word: 'un', clean_word: 'un', translit: null },
        { word: 'peu.', clean_word: 'peu', translit: null }
      ],
      vocabulary: {
        'repose-toi': { meaning: 'Descansa (tú)', part_of_speech: 'verbo' }
      }
    },
    {
      id: 'fr_cafe',
      triggers: ['café', 'cafe', 'thé', 'boire'],
      response: 'Un bon café chaud fait toujours du bien ! Tu le préfères noir ou au lait ?',
      translation: '¡Un buen café caliente siempre sienta bien! ¿Lo prefieres solo o con leche?',
      tokens: [
        { word: 'Un', clean_word: 'un', translit: null },
        { word: 'bon', clean_word: 'bon', translit: null },
        { word: 'café!', clean_word: 'café', translit: null }
      ],
      vocabulary: {
        'café': { meaning: 'Café', part_of_speech: 'sustantivo' }
      }
    }
  ],

  it: [
    {
      id: 'it_sonno',
      triggers: ['sonno', 'stanco', 'stanca', 'dormire'],
      response: 'Ti capisco benissimo! Riposati un po’ e rilassati con una bevanda calda.',
      translation: '¡Te entiendo perfectamente! Descansa un poco y relájate con una bebida caliente.',
      tokens: [
        { word: 'Riposati', clean_word: 'riposati', translit: null },
        { word: 'un', clean_word: 'un', translit: null },
        { word: 'po’!', clean_word: 'po', translit: null }
      ],
      vocabulary: {
        'riposati': { meaning: 'Descansa (tú)', part_of_speech: 'verbo' }
      }
    },
    {
      id: 'it_caffe',
      triggers: ['caffè', 'caffe', 'bere', 'tazza'],
      response: 'Un espresso fumante fa sempre miracoli! Lo preferisci amaro o con zucchero?',
      translation: '¡Un espresso humeante siempre hace milagros! ¿Lo prefieres solo o con azúcar?',
      tokens: [
        { word: 'Un', clean_word: 'un', translit: null },
        { word: 'espresso!', clean_word: 'espresso', translit: null }
      ],
      vocabulary: {
        'espresso': { meaning: 'Café expreso', part_of_speech: 'sustantivo' }
      }
    }
  ],

  es: [
    {
      id: 'es_como_estas',
      triggers: ['cómo estás', 'como estas', 'qué tal', 'que tal', 'cómo te va', 'como te va'],
      response: '¡Estoy genial, muchas gracias por preguntar! ¿Y tú, qué tal ha estado tu día?',
      translation: 'I am great, thank you so much for asking! And you, how has your day been?',
      tokens: [
        { word: '¡Estoy', clean_word: 'estoy', translit: null },
        { word: 'genial!', clean_word: 'genial', translit: null }
      ],
      vocabulary: {
        'genial': { meaning: 'Estupendo / excelente', part_of_speech: 'adjetivo' }
      }
    },
    {
      id: 'es_hola',
      triggers: ['hola', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas'],
      response: '¡Hola! Qué gusto saludarte. ¿De qué te gustaría charlar hoy en español?',
      translation: 'Hello! Nice to greet you. What would you like to chat about today in Spanish?',
      tokens: [
        { word: '¡Hola!', clean_word: 'hola', translit: null },
        { word: 'Qué', clean_word: 'qué', translit: null },
        { word: 'gusto!', clean_word: 'gusto', translit: null }
      ],
      vocabulary: {
        'gusto': { meaning: 'Placer o agrado', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'es_nombre',
      triggers: ['me llamo', 'mi nombre es', 'soy '],
      response: '¡Mucho gusto en conocerte! Es un placer practicar juntos. ¿De qué país o ciudad eres?',
      translation: 'Pleased to meet you! It is a pleasure to practice together. What country or city are you from?',
      tokens: [
        { word: '¡Mucho', clean_word: 'mucho', translit: null },
        { word: 'gusto!', clean_word: 'gusto', translit: null }
      ],
      vocabulary: {
        'conocerte': { meaning: 'Saber quién eres / saludarte', part_of_speech: 'verbo' }
      }
    },
    {
      id: 'es_sueno',
      triggers: ['sueño', 'sueno', 'cansado', 'cansada', 'dormir', 'agotado'],
      response: '¡Te comprendo totalmente! Descansa un poco y acuéstate temprano hoy. ¿Tuviste un día muy ocupado?',
      translation: 'I completely understand! Rest a bit and go to bed early today. Did you have a busy day?',
      tokens: [
        { word: 'Descansa', clean_word: 'descansa', translit: null },
        { word: 'un', clean_word: 'un', translit: null },
        { word: 'poco.', clean_word: 'poco', translit: null }
      ],
      vocabulary: {
        'descansa': { meaning: 'Toma reposo', part_of_speech: 'verbo (imperativo)' }
      }
    },
    {
      id: 'es_cafe',
      triggers: ['café', 'cafe', 'tomar', 'té', 'te', 'comer', 'comida'],
      response: '¡Un café recién preparado siempre viene de maravilla! ¿Lo prefieres solo o con leche?',
      translation: 'A freshly brewed coffee is always wonderful! Do you prefer it black or with milk?',
      tokens: [
        { word: '¡Un', clean_word: 'un', translit: null },
        { word: 'café!', clean_word: 'café', translit: null }
      ],
      vocabulary: {
        'maravilla': { meaning: 'Cosa extraordinaria o muy buena', part_of_speech: 'sustantivo' }
      }
    },
    {
      id: 'es_gracias',
      triggers: ['gracias', 'muchas gracias', 'agradezco'],
      response: '¡De nada! Es un placer ayudarte a practicar. ¿Qué otra cosa te gustaría aprender hoy?',
      translation: "You're welcome! It's a pleasure to help you practice. What else would you like to learn today?",
      tokens: [
        { word: '¡De', clean_word: 'de', translit: null },
        { word: 'nada!', clean_word: 'nada', translit: null }
      ],
      vocabulary: {
        'de nada': { meaning: 'Respuesta cortés a gracias', part_of_speech: 'expresión' }
      }
    }
  ],

  en: [
    {
      id: 'en_how_are_you',
      triggers: ['how are you', 'how is it going', 'how do you do', "what's up", 'whats up'],
      response: "I'm doing fantastic, thank you for asking! How has your day been so far?",
      translation: '¡Me va fantástico, gracias por preguntar! ¿Cómo ha estado tu día hasta ahora?',
      tokens: [
        { word: "I'm", clean_word: 'im', translit: null },
        { word: 'doing', clean_word: 'doing', translit: null },
        { word: 'fantastic!', clean_word: 'fantastic', translit: null }
      ],
      vocabulary: {
        'fantastic': { meaning: 'Fantástico o excelente', part_of_speech: 'adjective' }
      }
    },
    {
      id: 'en_hello',
      triggers: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
      response: "Hello there! It's great to talk to you. What would you like to discuss today?",
      translation: '¡Hola! Es genial hablar contigo. ¿De qué te gustaría hablar hoy?',
      tokens: [
        { word: 'Hello', clean_word: 'hello', translit: null },
        { word: 'there!', clean_word: 'there', translit: null }
      ],
      vocabulary: {
        'discuss': { meaning: 'Debatir, hablar o charlar', part_of_speech: 'verb' }
      }
    },
    {
      id: 'en_name',
      triggers: ['my name is', "i'm ", 'i am '],
      response: "It's wonderful to meet you! What city or country are you from?",
      translation: '¡Es maravilloso conocerte! ¿De qué ciudad o país eres?',
      tokens: [
        { word: 'Wonderful', clean_word: 'wonderful', translit: null },
        { word: 'to', clean_word: 'to', translit: null },
        { word: 'meet', clean_word: 'meet', translit: null },
        { word: 'you!', clean_word: 'you', translit: null }
      ],
      vocabulary: {
        'wonderful': { meaning: 'Maravilloso', part_of_speech: 'adjective' }
      }
    },
    {
      id: 'en_tired',
      triggers: ['tired', 'sleep', 'sleepy', 'exhausted'],
      response: "I totally get that! Make sure to take a break and get some good rest tonight. Did you work hard today?",
      translation: '¡Te comprendo totalmente! Asegúrate de descansar bien esta noche. ¿Trabajaste mucho hoy?',
      tokens: [
        { word: 'Take', clean_word: 'take', translit: null },
        { word: 'a', clean_word: 'a', translit: null },
        { word: 'break!', clean_word: 'break', translit: null }
      ],
      vocabulary: {
        'rest': { meaning: 'Descanso o reposo', part_of_speech: 'noun' }
      }
    },
    {
      id: 'en_coffee',
      triggers: ['coffee', 'tea', 'drink', 'food', 'eating'],
      response: "A cup of fresh coffee always hits the spot! Do you like yours black or with milk and sugar?",
      translation: '¡Una taza de café fresco siempre viene genial! ¿Te gusta solo o con leche y azúcar?',
      tokens: [
        { word: 'Fresh', clean_word: 'fresh', translit: null },
        { word: 'coffee!', clean_word: 'coffee', translit: null }
      ],
      vocabulary: {
        'fresh': { meaning: 'Fresco o recién hecho', part_of_speech: 'adjective' }
      }
    },
    {
      id: 'en_thanks',
      triggers: ['thank you', 'thanks', 'appreciate'],
      response: "You are very welcome! It's my pleasure to help you practice English. What topic should we try next?",
      translation: '¡De nada! Es mi placer ayudarte a practicar inglés. ¿Qué tema probamos ahora?',
      tokens: [
        { word: 'You', clean_word: 'you', translit: null },
        { word: 'are', clean_word: 'are', translit: null },
        { word: 'welcome!', clean_word: 'welcome', translit: null }
      ],
      vocabulary: {
        'welcome': { meaning: 'De nada / bienvenido', part_of_speech: 'phrase' }
      }
    }
  ]
};

/**
 * Adaptive responses for non-matched turns
 */
const ADAPTIVE_POOLS = {
  es: [
    {
      response: '¡Muy bien formulado! Cuéntame un poco más sobre eso, me interesa tu punto de vista.',
      translation: 'Very well formulated! Tell me a bit more about that, I am interested in your point of view.',
      vocabulary: { 'formulado': { meaning: 'Dicho o expresado', part_of_speech: 'adjetivo' } }
    },
    {
      response: '¡Totalmente de acuerdo! Es un tema genial para practicar conversación. ¿Qué opinas tú al respecto?',
      translation: 'Totally agree! It is a great topic to practice conversation. What do you think about it?',
      vocabulary: { 'opinas': { meaning: 'Consideras o piensas', part_of_speech: 'verbo' } }
    }
  ],
  en: [
    {
      response: 'That was very well expressed! Tell me a bit more about that, I would love to hear your thoughts.',
      translation: '¡Muy bien expresado! Cuéntame un poco más sobre eso, me encantaría escuchar tus pensamientos.',
      vocabulary: { 'expressed': { meaning: 'Expresado o comunicado', part_of_speech: 'adjective' } }
    },
    {
      response: 'I completely agree! That is a great topic to explore together. What is your perspective on it?',
      translation: '¡Totalmente de acuerdo! Es un gran tema para explorar juntos. ¿Cuál es tu perspectiva al respecto?',
      vocabulary: { 'perspective': { meaning: 'Perspectiva o punto de vista', part_of_speech: 'noun' } }
    }
  ],
  pl: [
    {
      response: 'Bardzo dobrze to ująłeś! Opowiedz mi o tym coś więcej, chętnie posłucham.',
      translation: '¡Lo dijiste muy bien! Cuéntame un poco más sobre eso, con gusto escucharé.',
      vocabulary: { 'opowiedz': { meaning: 'Cuenta o relata (tú)', part_of_speech: 'verbo' } }
    },
    {
      response: 'Zgadzam się z tobą! To świetny temat do ćwiczenia języka. Co o tym sądzisz?',
      translation: '¡Estoy de acuerdo contigo! Es un gran tema para practicar el idioma. ¿Qué opinas de esto?',
      vocabulary: { 'sądzisz': { meaning: 'Opines o piensas', part_of_speech: 'verbo' } }
    }
  ],
  ar: [
    {
      response: 'أَنْتَ تَتَحَدَّثُ بِطَرِيقَةٍ مُمْتَازَةٍ! أَخْبِرْنِي الْمَزِيدَ عَنْ ذَلِكَ، يَسُرُّنِي أَنْ أَسْمَعَ رَأْيَكَ.',
      translation: '¡Hablas de una manera excelente! Cuéntame más sobre eso, me complace escuchar tu opinión.',
      vocabulary: { 'أخبرني': { meaning: 'Cuéntame o dime', part_of_speech: 'verbo', translit: 'akhbirnī' } }
    },
    {
      response: 'أَنَا أُوَافِقُكَ الرَّأْيَ تَمَامًا! هَذَا مَوْضُوعٌ رَائِعٌ لِلتَّدْرِيبِ. مَاذَا تَعْتَقِدُ أَيْضًا؟',
      translation: '¡Estoy totalmente de acuerdo contigo! Este es un tema maravilloso para practicar. ¿Qué opinas además?',
      vocabulary: { 'أوافقك': { meaning: 'Estoy de acuerdo contigo', part_of_speech: 'verbo', translit: 'uwāfiquka' } }
    }
  ],
  zh: [
    {
      response: '你说得非常好！关于这个事情，你能跟我多分享一些具体的细节吗？',
      translation: '¡Lo dijiste muy bien! Sobre este asunto, ¿puedes compartir conmigo más detalles específicos?',
      tokens: [
        { word: '你说得', clean_word: '说', translit: 'nǐ shuō de' },
        { word: '非常好！', clean_word: '非常好', translit: 'fēicháng hǎo!' }
      ],
      vocabulary: { '具体': { meaning: 'Concreto o específico', part_of_speech: 'adjetivo', translit: 'jùtǐ' } }
    },
    {
      response: '我非常赞同你的看法！多用完整的句子表达，你的中文会越来越自然。',
      translation: '¡Concuerdo mucho con tu opinión! Expresándote con oraciones completas, tu chino será cada vez más natural.',
      tokens: [
        { word: '赞同', clean_word: '赞同', translit: 'zàntóng' }
      ],
      vocabulary: { '赞同': { meaning: 'Estar de acuerdo', part_of_speech: 'verbo', translit: 'zàntóng' } }
    }
  ],
  ru: [
    {
      response: 'Ты отлично выражаешь свои мысли! Расскажи мне об этом подробнее, мне очень интересно.',
      translation: '¡Expresas tus ideas genial! Cuéntame de esto con más detalle, me interesa mucho.',
      vocabulary: { 'подробнее': { meaning: 'Más detalladamente', part_of_speech: 'adverbio', translit: 'podrobneye' } }
    },
    {
      response: 'Я полностью согласен! Это отличная тема для практики. Что ты думаешь об этом?',
      translation: '¡Estoy totalmente de acuerdo! Es un tema excelente para practicar. ¿Qué piensas de esto?',
      vocabulary: { 'согласен': { meaning: 'De acuerdo', part_of_speech: 'adjetivo breve', translit: 'soglasen' } }
    }
  ],
  nl: [
    {
      response: 'Wat goed geformuleerd! Vertel me daar graag wat meer over, ik luister met veel interesse.',
      translation: '¡Qué bien formulado! Cuéntame un poco más sobre eso, escucho con mucho interés.',
      vocabulary: { 'geformuleerd': { meaning: 'Formulado o expresado', part_of_speech: 'adjetief' } }
    },
    {
      response: 'Dat is een heel goed punt! Het is fijn om hierover samen in het Nederlands te praten. Wat denk jij ervan?',
      translation: '¡Ese es un muy buen punto! Es agradable hablar de esto juntos en neerlandés. ¿Qué opinas?',
      vocabulary: { 'punt': { meaning: 'Punto o aspecto', part_of_speech: 'sustantivo' } }
    }
  ],
  de: [
    {
      response: 'Das hast du super ausgedrückt! Erzähl mir gerne noch ein bisschen mehr darüber.',
      translation: '¡Lo expresaste súper bien! Cuéntame un poco mehr über ello con gusto.',
      vocabulary: { 'ausgedrückt': { meaning: 'Expresado', part_of_speech: 'partizip' } }
    },
    {
      response: 'Da stimme ich dir vollkommen zu! Das ist ein prima Thema zum Üben. Was meinst du dazu?',
      translation: '¡Estoy totalmente de acuerdo contigo! Es un gran tema para practicar. ¿Qué opinas al respecto?',
      vocabulary: { 'vollkommen': { meaning: 'Completamente', part_of_speech: 'adverb' } }
    }
  ],
  fr: [
    {
      response: "C'est très bien formulé ! Raconte-moi un peu plus à ce sujet, je t'écoute avec plaisir.",
      translation: '¡Está muy bien formulado! Cuéntame un poco más al respecto, te escucho con mucho gusto.',
      vocabulary: { 'formulé': { meaning: 'Expresado o dicho', part_of_speech: 'adjectif' } }
    },
    {
      response: "Je suis tout à fait d'accord avec toi ! C'est un excellent sujet de discussion. Qu'en penses-tu ?",
      translation: '¡Estoy totalmente de acuerdo contigo! Es un excelente tema de conversación. ¿Qué opinas?',
      vocabulary: { 'accord': { meaning: 'Acuerdo', part_of_speech: 'nom' } }
    }
  ],
  it: [
    {
      response: 'Ti esprimi davvero bene! Raccontami qualcosa in più su questo argomento, ti ascolto volentieri.',
      translation: '¡Te expresas realmente bien! Cuéntame algo más sobre este tema, te escucho con gusto.',
      vocabulary: { 'argomento': { meaning: 'Tema o asunto', part_of_speech: 'sostantivo' } }
    },
    {
      response: 'Sono d’accordissimo con te! È un ottimo spunto per fare pratica. Cosa ne pensi?',
      translation: '¡Estoy de acuerdísimo contigo! Es un excelente punto para practicar. ¿Qué opinas?',
      vocabulary: { 'ottimo': { meaning: 'Excelente u óptimo', part_of_speech: 'aggettivo' } }
    }
  ]
};

/**
 * High-frequency code-switching vocabulary lexicon
 * Translates native language (Spanish / English) words mixed into target languages
 */
export const CODE_SWITCHING_LEXICON = {
  nl: {
    'sopa': 'soep', 'sopas': 'soepen', 'soup': 'soep',
    'verdura': 'groente', 'verduras': 'groenten', 'vegetales': 'groenten', 'vegetable': 'groente', 'vegetables': 'groenten',
    'comida': 'eten', 'food': 'eten',
    'carne': 'vlees', 'meat': 'vlees',
    'pollo': 'kip', 'chicken': 'kip',
    'pescado': 'vis', 'fish': 'vis',
    'arroz': 'rijst', 'rice': 'rijst',
    'pan': 'brood', 'bread': 'brood',
    'queso': 'kaas', 'cheese': 'kaas',
    'huevo': 'ei', 'huevos': 'eieren', 'egg': 'ei', 'eggs': 'eieren',
    'leche': 'melk', 'milk': 'melk',
    'agua': 'water', 'water': 'water',
    'café': 'koffie', 'cafe': 'koffie', 'coffee': 'koffie',
    'té': 'thee', 'te': 'thee', 'tea': 'thee',
    'azúcar': 'suiker', 'azucar': 'suiker', 'sugar': 'suiker',
    'sal': 'zout', 'salt': 'zout',
    'pimienta': 'peper', 'pepper': 'peper',
    'aceite': 'olie', 'oil': 'olie',
    'mantequilla': 'boter', 'butter': 'boter',
    'fruta': 'fruit', 'frutas': 'fruit', 'fruit': 'fruit',
    'manzana': 'appel', 'manzanas': 'appels', 'apple': 'appel', 'apples': 'appels',
    'papa': 'aardappel', 'papas': 'aardappels', 'patata': 'aardappel', 'patatas': 'aardappels', 'potato': 'aardappel', 'potatoes': 'aardappels',
    'cebolla': 'ui', 'cebollas': 'uien', 'onion': 'ui', 'onions': 'uien',
    'tomate': 'tomaat', 'tomates': 'tomaten', 'tomato': 'tomaat', 'tomatoes': 'tomaten',
    'ajo': 'knoflook', 'garlic': 'knoflook',
    'zanahoria': 'wortel', 'zanahorias': 'wortelen', 'carrot': 'wortel', 'carrots': 'wortels',
    'con': 'met', 'with': 'met',
    'sin': 'zonder', 'without': 'zonder',
    'para': 'voor', 'for': 'voor',
    'de': 'van', 'from': 'van',
    'y': 'en', 'and': 'en',
    'o': 'of', 'or': 'of',
    'pero': 'maar', 'but': 'maar',
    'porque': 'omdat', 'because': 'omdat',
    'hacer': 'maken', 'make': 'maken',
    'cocinar': 'koken', 'cook': 'koken',
    'comer': 'eten', 'eat': 'eten',
    'beber': 'drinken', 'tomar': 'drinken', 'drink': 'drinken',
    'casa': 'huis', 'house': 'huis',
    'amigo': 'vriend', 'amiga': 'vriendin', 'amigos': 'vrienden', 'friend': 'vriend',
    'libro': 'boek', 'libros': 'boeken', 'book': 'boek',
    'ciudad': 'stad', 'city': 'stad',
    'país': 'land', 'pais': 'land', 'country': 'land',
    'tiempo': 'tijd', 'time': 'tijd',
    'hoy': 'vandaag', 'today': 'vandaag',
    'mañana': 'morgen', 'tomorrow': 'morgen',
    'ayer': 'gisteren', 'yesterday': 'gisteren'
  },
  pl: {
    'sopa': 'zupę', 'verduras': 'warzywa', 'vegetales': 'warzywa', 'carne': 'mięso', 'pollo': 'kurczaka',
    'pescado': 'rybę', 'arroz': 'ryż', 'pan': 'chleb', 'queso': 'ser', 'huevo': 'jajko', 'leche': 'mleko',
    'agua': 'wodę', 'café': 'kawę', 'cafe': 'kawę', 'té': 'herbatę', 'te': 'herbatę', 'azúcar': 'cukier',
    'con': 'z', 'sin': 'bez', 'para': 'dla', 'y': 'i', 'pero': 'ale',
    'hacer': 'robić', 'cocinar': 'gotować', 'comer': 'jeść', 'beber': 'pić', 'tomar': 'pić',
    'casa': 'dom', 'amigo': 'przyjaciel', 'libro': 'książkę'
  },
  de: {
    'sopa': 'Suppe', 'verduras': 'Gemüse', 'vegetales': 'Gemüse', 'carne': 'Fleisch', 'pollo': 'Hähnchen',
    'pescado': 'Fisch', 'arroz': 'Reis', 'pan': 'Brot', 'queso': 'Käse', 'huevo': 'Ei', 'leche': 'Milch',
    'agua': 'Wasser', 'café': 'Kaffee', 'cafe': 'Kaffee', 'té': 'Tee', 'te': 'Tee', 'azúcar': 'Zucker',
    'con': 'mit', 'sin': 'ohne', 'para': 'für', 'y': 'und', 'pero': 'aber',
    'hacer': 'machen', 'cocinar': 'kochen', 'comer': 'essen', 'beber': 'trinken', 'tomar': 'trinken',
    'casa': 'Haus', 'amigo': 'Freund', 'libro': 'Buch'
  },
  fr: {
    'sopa': 'soupe', 'verduras': 'légumes', 'vegetales': 'légumes', 'carne': 'viande', 'pollo': 'poulet',
    'pescado': 'poisson', 'arroz': 'riz', 'pan': 'pain', 'queso': 'fromage', 'huevo': 'œuf', 'leche': 'lait',
    'agua': 'eau', 'café': 'café', 'cafe': 'café', 'té': 'thé', 'te': 'thé', 'azúcar': 'sucre',
    'con': 'avec', 'sin': 'sans', 'para': 'pour', 'y': 'et', 'pero': 'mais',
    'hacer': 'faire', 'cocinar': 'cuisiner', 'comer': 'manger', 'beber': 'boire', 'tomar': 'prendre',
    'casa': 'maison', 'amigo': 'ami', 'libro': 'livre'
  },
  it: {
    'sopa': 'zuppa', 'verduras': 'verdure', 'vegetales': 'verdure', 'carne': 'carne', 'pollo': 'pollo',
    'pescado': 'pesce', 'arroz': 'riso', 'pan': 'pane', 'queso': 'formaggio', 'huevo': 'uovo', 'leche': 'latte',
    'agua': 'acqua', 'café': 'caffè', 'cafe': 'caffè', 'té': 'tè', 'te': 'tè', 'azúcar': 'zucchero',
    'con': 'con', 'sin': 'senza', 'para': 'per', 'y': 'e', 'pero': 'ma',
    'hacer': 'fare', 'cocinar': 'cucinare', 'comer': 'mangiare', 'beber': 'bere',
    'casa': 'casa', 'amigo': 'amico', 'libro': 'libro'
  },
  ru: {
    'sopa': 'суп', 'verduras': 'овощи', 'carne': 'мясо', 'agua': 'воду', 'café': 'кофе', 'leche': 'молоко',
    'con': 'с', 'sin': 'без', 'hacer': 'делать', 'cocinar': 'готовить', 'comer': 'есть', 'beber': 'пить',
    'casa': 'дом', 'amigo': 'друг', 'libro': 'книгу'
  },
  ar: {
    'sopa': 'حَسَاء', 'verduras': 'خُضْرَاوَات', 'agua': 'مَاء', 'café': 'قَهْوَة', 'leche': 'حَلِيب',
    'con': 'مَعَ', 'sin': 'بِدُونِ', 'hacer': 'أَفْعَل', 'cocinar': 'أَطْبُخ', 'comer': 'آكُل', 'beber': 'أَشْرَب',
    'casa': 'بَيْت'
  },
  zh: {
    'sopa': '汤', 'verduras': '蔬菜', 'agua': '水', 'café': '咖啡', 'leche': '牛奶',
    'con': '和', 'hacer': '做', 'cocinar': '做饭', 'comer': '吃', 'beber': '喝',
    'casa': '家'
  },
  en: {
    'sopa': 'soup', 'verduras': 'vegetables', 'vegetales': 'vegetables', 'carne': 'meat', 'pollo': 'chicken',
    'pescado': 'fish', 'arroz': 'rice', 'pan': 'bread', 'queso': 'cheese', 'huevo': 'egg', 'leche': 'milk',
    'agua': 'water', 'café': 'coffee', 'cafe': 'coffee', 'té': 'tea', 'te': 'tea', 'azúcar': 'sugar',
    'con': 'with', 'sin': 'without', 'para': 'for', 'y': 'and', 'pero': 'but',
    'hacer': 'make', 'cocinar': 'cook', 'comer': 'eat', 'beber': 'drink', 'tomar': 'drink',
    'casa': 'house', 'amigo': 'friend', 'libro': 'book'
  },
  es: {
    'soup': 'sopa', 'vegetables': 'verduras', 'meat': 'carne', 'chicken': 'pollo',
    'water': 'agua', 'coffee': 'café', 'tea': 'té', 'milk': 'leche',
    'with': 'con', 'without': 'sin', 'make': 'hacer', 'cook': 'cocinar', 'eat': 'comer'
  }
};

/**
 * Translate native vocabulary words mixed inside the sentence (Code-Switching)
 */
export function translateMixedNativeVocabulary(text, targetLang = 'nl') {
  if (!text) return text;
  const langLex = CODE_SWITCHING_LEXICON[targetLang];
  if (!langLex) return text;

  return text.replace(/[\p{L}]+/gu, (match) => {
    const lower = match.toLowerCase();
    if (langLex[lower]) {
      const translated = langLex[lower];
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return translated.charAt(0).toUpperCase() + translated.slice(1);
      }
      return translated;
    }
    return match;
  });
}

/**
 * Main engine processing function
 */
export function processSmartConversation(message, targetLang = 'pl', nativeLang = 'es', history = []) {
  const langKey = GRAMMAR_RULES[targetLang] ? targetLang : 'pl';
  const rules = GRAMMAR_RULES[langKey] || [];
  let correctedText = (message || '').trim();
  let hasErrors = false;

  // 1. Translate mixed native vocabulary words (Code-Switching, e.g. sopa -> soep, verduras -> groenten)
  const translatedVocab = translateMixedNativeVocabulary(correctedText, targetLang);
  if (translatedVocab !== correctedText) {
    correctedText = translatedVocab;
    hasErrors = true;
  }

  // 2. Check grammar rules for the specific target language
  for (const rule of rules) {
    if (rule.regex.test(correctedText)) {
      correctedText = correctedText.replace(rule.regex, rule.replacement);
      hasErrors = true;
    }
  }

  // 3. Compute fine-grained diff tokens
  const diffTokens = computeWordDiff(message, correctedText);

  // 4. Topic matching across both original and translated text
  const originalLower = (message || '').toLowerCase();
  const correctedLower = correctedText.toLowerCase();

  const recentBotTexts = history.filter(h => h.sender === 'bot').slice(-2).map(h => h.text);
  const topics = CONVERSATION_TOPICS[langKey] || CONVERSATION_TOPICS['pl'];
  let matchedTopic = null;

  // Check specific content topics first (food, soup, drinks, hobbies, etc.) before generic question openers
  for (const topic of topics) {
    const isRepeat = recentBotTexts.includes(topic.response);
    if (!isRepeat && topic.triggers.some(trig => originalLower.includes(trig) || correctedLower.includes(trig))) {
      matchedTopic = topic;
      break;
    }
  }

  // 5. Contextual reflection fallback if no direct trigger
  if (!matchedTopic) {
    const turnCount = history.filter(h => h.sender === 'user').length;
    const pool = ADAPTIVE_POOLS[langKey] || ADAPTIVE_POOLS['pl'];
    let available = pool.filter(p => !recentBotTexts.includes(p.response));
    if (available.length === 0) available = pool;

    const item = available[turnCount % available.length];
    matchedTopic = {
      response: item.response,
      translation: item.translation,
      tokens: item.tokens || tokenizeSimple(item.response),
      vocabulary: item.vocabulary || {}
    };
  }

  return {
    user_correction: {
      original_text: message,
      corrected_text: correctedText,
      has_errors: hasErrors || diffTokens.some(t => t.changed),
      diff_tokens: diffTokens
    },
    bot_response: {
      text: matchedTopic.response,
      translation: matchedTopic.translation,
      tokens: matchedTopic.tokens || tokenizeSimple(matchedTopic.response),
      vocabulary: matchedTopic.vocabulary || {}
    }
  };
}

function tokenizeSimple(text) {
  const parts = text.split(/(\s+)/);
  return parts.map(p => ({
    word: p,
    clean_word: p.replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '').toLowerCase(),
    translit: null
  })).filter(t => t.word.trim().length > 0);
}
