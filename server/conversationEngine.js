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
 * Deterministic Linguistic Processing (Grammar corrections, code-switching & word-diff)
 * Does NOT generate conversational bot responses. Conversational generation belongs exclusively to Gemini AI.
 */
export function processDeterministicLinguistics(message, targetLang = 'pl', nativeLang = 'es') {
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

  return {
    original_text: message,
    corrected_text: correctedText,
    has_errors: hasErrors || diffTokens.some(t => t.changed),
    diff_tokens: diffTokens
  };
}

export const processSmartConversation = processDeterministicLinguistics;

export function tokenizeSimple(text) {
  if (!text) return [];
  const parts = text.split(/(\s+)/);
  return parts.map(p => ({
    word: p,
    clean_word: p.replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '').toLowerCase(),
    translit: null
  })).filter(t => t.word.trim().length > 0);
}
