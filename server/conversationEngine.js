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
    { regex: /\bik\s+gaan\b/gi, replacement: 'ik ga' }
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
  ]
};

/**
 * Adaptive responses for non-matched turns
 */
const ADAPTIVE_POOLS = {
  pl: [
    {
      response: 'Bardzo dobrze to ująłeś! Jak długo już uczysz się polskiego?',
      translation: '¡Lo dijiste muy bien! ¿Cuánto tiempo llevas aprendiendo polaco?',
      vocabulary: { 'uczysz': { meaning: 'Aprendes o estudias', part_of_speech: 'verbo' } }
    },
    {
      response: 'Świetnie ci idzie! Czy masz ulubiony temat do rozmów?',
      translation: '¡Te va genial! ¿Tienes algún tema favorito para conversar?',
      vocabulary: { 'świetnie': { meaning: 'Estupendamente o genial', part_of_speech: 'adverbio' } }
    },
    {
      response: 'Całkowicie się zgadzam. O czym jeszcze chciałbyś porozmawiać?',
      translation: 'Totalmente de acuerdo. ¿De qué más te gustaría hablar?',
      vocabulary: { 'porozmawiać': { meaning: 'Charlar o conversar', part_of_speech: 'verbo' } }
    }
  ],
  ar: [
    {
      response: 'أَنْتَ تَتَحَدَّثُ بِطَرِيقَةٍ مُمْتَازَةٍ! كَمْ لَكَ مِنْ وَقْتٍ تَتَعَلَّمُ فِيهِ اللُّغَةَ الْعَرَبِيَّةَ؟',
      translation: '¡Hablas de una manera excelente! ¿Cuánto tiempo llevas aprendiendo árabe?',
      vocabulary: { 'ممتازة': { meaning: 'Excelente o magnífica', part_of_speech: 'adjetivo', translit: 'mumtāzah' } }
    },
    {
      response: 'هَذَا رَائِعٌ جِدًّا! عَنْ أَيِّ مَوْضُوعٍ تُفَضِّلُ أَنْ نَتَحَدَّثَ الْآنَ؟',
      translation: '¡Eso es maravilloso! ¿Sobre qué tema prefieres que conversemos ahora?',
      vocabulary: { 'موضوع': { meaning: 'Tema o asunto', part_of_speech: 'sustantivo', translit: 'mawḍū‘' } }
    }
  ],
  zh: [
    {
      response: '你说得非常好！平时你喜欢看什么类型的中国电影或者电视剧吗？',
      translation: '¡Lo dijiste muy bien! ¿Qué tipo de películas o series chinas te gusta ver habitualmente?',
      tokens: [
        { word: '你说得', clean_word: '说', translit: 'nǐ shuō de' },
        { word: '非常好！', clean_word: '非常好', translit: 'fēicháng hǎo!' }
      ],
      vocabulary: { '非常好': { meaning: 'Muy bien o excelente', part_of_speech: 'frase', translit: 'fēicháng hǎo' } }
    },
    {
      response: '太有意思了！每天多练习几句，你的中文表达会越来越地道。',
      translation: '¡Qué interesante! Practicando unas frases cada día, tu expresión en chino será cada vez más auténtica.',
      tokens: [
        { word: '太有意思了！', clean_word: '有意思', translit: 'tài yǒu yìsi le!' }
      ],
      vocabulary: { '有意思': { meaning: 'Interesante o curioso', part_of_speech: 'adjetivo', translit: 'yǒu yìsi' } }
    }
  ],
  ru: [
    {
      response: 'Ты отлично выражаешь свои мысли! Как давно ты изучаешь русский язык?',
      translation: '¡Expresas tus ideas genial! ¿Cuánto tiempo llevas estudiando ruso?',
      vocabulary: { 'отлично': { meaning: 'Excelente o genial', part_of_speech: 'adverbio', translit: 'otlichno' } }
    },
    {
      response: 'Очень интересно! Какая тема для разговора тебе нравится больше всего?',
      translation: '¡Muy interesante! ¿Qué tema de conversación te gusta más?',
      vocabulary: { 'интересно': { meaning: 'Interesante', part_of_speech: 'adverbio', translit: 'interesno' } }
    }
  ],
  nl: [
    {
      response: 'Wat goed gezegd! Hoe lang ben je al bezig met Nederlands leren?',
      translation: '¡Qué bien dicho! ¿Cuánto tiempo llevas aprendiendo holandés?',
      vocabulary: { 'bezig': { meaning: 'Ocupado o dedicado a algo', part_of_speech: 'adjetivo' } }
    },
    {
      response: 'Heel interessant! Waar praat je het liefst over in je vrije tijd?',
      translation: '¡Muy interesante! ¿De qué prefieres hablar en tu tiempo libre?',
      vocabulary: { 'interessant': { meaning: 'Interesante', part_of_speech: 'adjetivo' } }
    }
  ],
  de: [
    {
      response: 'Das hast du super gesagt! Wie lange lernst du schon Deutsch?',
      translation: '¡Lo dijiste súper bien! ¿Cuánto tiempo llevas aprendiendo alemán?',
      vocabulary: { 'super': { meaning: 'Genial o excelente', part_of_speech: 'adverbio' } }
    },
    {
      response: 'Sehr interessant! Worüber unterhältst du dich am liebsten?',
      translation: '¡Muy interesante! ¿De qué prefieres conversar?',
      vocabulary: { 'interessant': { meaning: 'Interesante', part_of_speech: 'adjetivo' } }
    }
  ],
  fr: [
    {
      response: "C'est très bien formulé ! Depuis combien de temps apprends-tu le français ?",
      translation: '¡Está muy bien formulado! ¿Desde hace cuánto tiempo aprendes francés?',
      vocabulary: { 'formulé': { meaning: 'Expresado o dicho', part_of_speech: 'adjectif' } }
    },
    {
      response: "C'est passionnant ! De quel sujet aimes-tu discuter d'habitude ?",
      translation: '¡Es apasionante! ¿De qué tema te gusta charlar habitualmente?',
      vocabulary: { 'passionnant': { meaning: 'Apasionante o fascinante', part_of_speech: 'adjectif' } }
    }
  ],
  it: [
    {
      response: 'Complimenti, ti esprimi davvero bene! Da quanto tempo studi l’italiano?',
      translation: '¡Felicitaciones, te expresas muy bien! ¿Desde hace cuánto tiempo estudias italiano?',
      vocabulary: { 'complimenti': { meaning: 'Felicitaciones', part_of_speech: 'interiezione' } }
    },
    {
      response: 'Molto interessante! Di cosa ti piace parlare nel tuo tempo libero?',
      translation: '¡Muy interesante! ¿De qué te gusta hablar en tu tiempo libre?',
      vocabulary: { 'interessante': { meaning: 'Interesante', part_of_speech: 'aggettivo' } }
    }
  ]
};

/**
 * Main engine processing function
 */
export function processSmartConversation(message, targetLang = 'pl', nativeLang = 'es', history = []) {
  const langKey = GRAMMAR_RULES[targetLang] ? targetLang : 'pl';
  const rules = GRAMMAR_RULES[langKey] || [];
  let correctedText = message;
  let hasErrors = false;
  const originalLower = message.toLowerCase();

  // 1. Check grammar rules for the specific target language
  for (const rule of rules) {
    if (rule.regex.test(correctedText)) {
      correctedText = correctedText.replace(rule.regex, rule.replacement);
      hasErrors = true;
    }
  }

  // 2. Compute fine-grained diff tokens
  const diffTokens = computeWordDiff(message, correctedText);

  // 3. Prevent repeating recent bot messages
  const recentBotTexts = history.filter(h => h.sender === 'bot').slice(-2).map(h => h.text);

  // 4. Find topic match
  const topics = CONVERSATION_TOPICS[langKey] || CONVERSATION_TOPICS['pl'];
  let matchedTopic = null;

  for (const topic of topics) {
    const isRepeat = recentBotTexts.includes(topic.response);
    if (!isRepeat && topic.triggers.some(trig => originalLower.includes(trig))) {
      matchedTopic = topic;
      break;
    }
  }

  // 5. Adaptive turn fallback if no direct trigger
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
      has_errors: hasErrors,
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
