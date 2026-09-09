import { computeWordDiff } from '../../server/languageData.js';

const LT_LANG_MAP = {
  es: 'es',
  en: 'en-US',
  pl: 'pl-PL',
  de: 'de-DE',
  fr: 'fr',
  it: 'it',
  ru: 'ru-RU',
  nl: 'nl-NL',
  zh: 'zh-CN',
  ar: 'ar'
};

/**
 * Cross-language translations for common learner phrases
 * (When the user types in Spanish while practicing another target language)
 */
const SPANISH_CROSS_CORRECTIONS = {
  pl: [
    { regex: /\b(hola|buenas|buen d[ií]a|buenos d[ií]as)\b/gi, replacement: 'Cześć!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Jak się masz?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o|tengo sue[nñ]ito)\b/gi, replacement: 'Chce mi się spać', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé]|un caf[eé] por favor)\b/gi, replacement: 'Poproszę kawę', orig: 'quiero café' },
    { regex: /\b(gracias|muchas gracias)\b/gi, replacement: 'Dziękuję!', orig: 'gracias' },
    { regex: /\b(por favor)\b/gi, replacement: 'Proszę', orig: 'por favor' },
    { regex: /\b(adi[oó]s|chau|hasta luego)\b/gi, replacement: 'Do widzenia!', orig: 'adiós' },
    { regex: /\b(me llamo|mi nombre es)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/gi, replacement: 'Nazywam się $2', orig: 'me llamo' },
    { regex: /\b(soy de|vengo de)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/gi, replacement: 'Jestem z $2', orig: 'soy de' },
    { regex: /\b(no entiendo|no comprendo)\b/gi, replacement: 'Nie rozumiem', orig: 'no entiendo' }
  ],
  ar: [
    { regex: /\b(hola|buenas|buen d[ií]a)\b/gi, replacement: 'مَرْحَبًا!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'كَيْفَ حَالُكَ؟', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: 'أَنَا أَشْعُرُ بِالنُّعَاسِ', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'أُرِيدُ قَهْوَةً', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: 'شُكْرًا جَزِيلًا', orig: 'gracias' },
    { regex: /\b(por favor)\b/gi, replacement: 'مِنْ فَضْلِكَ', orig: 'por favor' }
  ],
  fr: [
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: 'Bonjour !', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Comment ça va ?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: "J'ai sommeil", orig: 'tengo sueño' },
    { regex: /\b(tengo hambre)\b/gi, replacement: "J'ai faim", orig: 'tengo hambre' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'Je voudrais un café', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: 'Merci beaucoup !', orig: 'gracias' }
  ],
  de: [
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: 'Hallo! Guten Tag!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Wie geht es dir?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: 'Ich bin müde', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'Ich möchte einen Kaffee', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: 'Danke schön!', orig: 'gracias' }
  ],
  it: [
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: 'Ciao! Buongiorno!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Come stai?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: 'Ho sonno', orig: 'tengo sueño' },
    { regex: /\b(tengo hambre)\b/gi, replacement: 'Ho fame', orig: 'tengo hambre' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'Vorrei un caffè', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: 'Grazie mille!', orig: 'gracias' }
  ],
  ru: [
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: 'Привет! Здравствуйте!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Как дела?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: 'Я хочу спать', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'Я хочу кофе', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: 'Спасибо большое!', orig: 'gracias' }
  ],
  nl: [
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: 'Hallo! Goedendag!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Hoe gaat het?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: 'Ik ben moe', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: 'Ik wil graag een koffie', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: 'Dank je wel!', orig: 'gracias' }
  ],
  zh: [
    { regex: /\b(hola|buenos d[ií]as)\b/gi, replacement: '你好！', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: '你好吗？最近怎么样？', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o)\b/gi, replacement: '我很困，想睡觉', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé])\b/gi, replacement: '我想喝咖啡', orig: 'quiero café' },
    { regex: /\b(gracias)\b/gi, replacement: '非常感谢！', orig: 'gracias' }
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
 * Deep Target Language Grammatical Rules (conjugation, case, pronouns, diacritics)
 */
const DEEP_LANGUAGE_RULES = {
  pl: [
    // Idioms & Sleep
    { regex: /\bja\s+(mieć|miec)\s+(sen|senność|sennosc)\b/gi, replacement: 'chce mi się spać' },
    { regex: /\b(mam|mieć|miec)\s+sen\b/gi, replacement: 'chce mi się spać' },
    { regex: /\b(jestem|być|byc)\s+sen(ny|na)\b/gi, replacement: 'jestem senny' },
    // Polish diacritics and verb forms
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
    { regex: /\bjak\s+sie\s+masz\b/gi, replacement: 'jak się masz' }
  ],
  ar: [
    { regex: /[أا]نا\s+نوم/g, replacement: 'أَنَا نَعْسَانُ' },
    { regex: /[أا]نا\s+[يأا]ريد/g, replacement: 'أَنَا أُرِيدُ' },
    { regex: /[أا]نا\s+[يأا]شرب/g, replacement: 'أَنَا أَشْرَبُ' },
    { regex: /[أا]ريد\s+قهو[ةه]/g, replacement: 'أُرِيدُ قَهْوَةً' },
    { regex: /[أا]ريد\s+ما[ءء]/g, replacement: 'أُرِيدُ مَاءً' },
    { regex: /كيف\s+حال/g, replacement: 'كَيْفَ حَالُكَ؟' },
    { regex: /صباح\s+خير/g, replacement: 'صَبَاحُ الخَيْرِ' },
    { regex: /مساء\s+خير/g, replacement: 'مَسَاءُ الخَيْرِ' }
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
  ru: [
    { regex: /\bя\s+хотеть\s+спать\b/gi, replacement: 'я хочу спать' },
    { regex: /\bя\s+иметь\s+спать\b/gi, replacement: 'я хочу спать' },
    { regex: /\bя\s+хотеть\b/gi, replacement: 'я хочу' },
    { regex: /\bя\s+идти\b/gi, replacement: 'я иду' },
    { regex: /\bя\s+пить\b/gi, replacement: 'я пью' },
    { regex: /\bя\s+любить\b/gi, replacement: 'я люблю' }
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
    // Frequent Dutch learner spelling (double vowels before single consonants in open syllables)
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
  zh: [
    { regex: /我困/g, replacement: '我很困' },
    { regex: /我睡觉/g, replacement: '我想去睡觉' },
    { regex: /我喝咖啡/g, replacement: '我想喝杯咖啡' },
    { regex: /你好吗/g, replacement: '你好，最近怎么样？' }
  ]
};

/**
 * Check with LanguageTool public API
 */
export async function checkLanguageTool(text, targetLang) {
  const ltLang = LT_LANG_MAP[targetLang];
  if (!ltLang) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for reliable LanguageTool response

    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        text: text.trim(),
        language: ltLang,
        level: 'picky'
      })
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.matches && data.matches.length > 0) {
        let corrected = text.trim();
        // Sort matches from end to start to preserve character offsets
        const sortedMatches = [...data.matches].sort((a, b) => b.offset - a.offset);

        let replacedAny = false;
        for (const match of sortedMatches) {
          // Exclude rules that are just about beginning with uppercase if sentence is single word
          if (match.replacements && match.replacements.length > 0) {
            const replValue = match.replacements[0].value;
            const start = match.offset;
            const end = match.offset + match.length;
            corrected = corrected.slice(0, start) + replValue + corrected.slice(end);
            replacedAny = true;
          }
        }

        if (replacedAny && corrected !== text.trim()) {
          return corrected;
        }
      }
    }
  } catch (err) {
    // Graceful fallback to rule engine
  }
  return null;
}

/**
 * Master Grammar Correction Function
 * Combines LanguageTool + Deep Conjugation/Case Rules + Cross-Language Translations
 */
export async function performFullGrammarCorrection(text, targetLang = 'pl', nativeLang = 'es', apiKey = '') {
  const original = (text || '').trim();
  if (!original) {
    return {
      original_text: '',
      corrected_text: '',
      has_errors: false,
      diff_tokens: []
    };
  }

  // 0. If Gemini API key is available, use direct AI for maximum intelligence & code-switching translation
  if (apiKey && apiKey.trim()) {
    try {
      const prompt = `You are an expert strict multilingual grammar teacher.
The student is practicing target language: "${targetLang}".
Student's native language is: "${nativeLang}".
Student wrote: "${original}".

CRITICAL INSTRUCTIONS:
1. If the student wrote any words, vocabulary, or phrases in their native language (${nativeLang}) or mixed languages (code-switching), you MUST translate and convert those native words into natural, proper ${targetLang} in "corrected_text".
2. Strictly correct all spelling, conjugation, diacritics, agreement, and grammar mistakes in ${targetLang}.
3. In "diff_tokens", divide the corrected sentence into words. For every word that was corrected or translated from ${nativeLang}, set "changed": true and "original": "[the exact word or phrase from the student's original input]". For untouched correct words, set "changed": false and "original": null.

Return STRICTLY JSON format:
{
  "original_text": "${original}",
  "corrected_text": "string",
  "has_errors": boolean,
  "diff_tokens": [
    { "text": "string", "changed": boolean, "original": "string or null" }
  ]
}`;
      const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 9000);
          const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
            })
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (raw) {
              const parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim());
              if (parsed && parsed.corrected_text && parsed.diff_tokens) {
                return parsed;
              }
            }
          }
        } catch (mErr) {
          // try next model
        }
      }
    } catch (err) {
      console.warn('Gemini re-analysis notice:', err.message);
    }
  }

  let corrected = original;
  let hasErrors = false;

  // 1. Translate mixed native vocabulary words (Code-Switching, e.g. sopa -> soep, verduras -> groenten)
  const translatedVocab = translateMixedNativeVocabulary(corrected, targetLang);
  if (translatedVocab !== corrected) {
    corrected = translatedVocab;
    hasErrors = true;
  }

  // 2. Check Spanish/English cross-corrections if user wrote in native language
  const crossRules = SPANISH_CROSS_CORRECTIONS[targetLang] || [];
  for (const rule of crossRules) {
    if (rule.regex.test(corrected)) {
      corrected = corrected.replace(rule.regex, rule.replacement);
      hasErrors = true;
    }
  }

  // 3. Check Deep Grammatical Rules (conjugation, case, diacritics, idioms)
  const rules = DEEP_LANGUAGE_RULES[targetLang] || [];
  for (const rule of rules) {
    if (rule.regex.test(corrected)) {
      corrected = corrected.replace(rule.regex, rule.replacement);
      hasErrors = true;
    }
  }

  // 4. Asynchronously call LanguageTool for typo/spelling/advanced grammar
  try {
    const ltResult = await checkLanguageTool(corrected, targetLang);
    if (ltResult && ltResult !== corrected) {
      corrected = ltResult;
      hasErrors = true;
    }
  } catch (e) {}

  // 5. If corrected differs from original, errors occurred
  if (corrected.toLowerCase().trim() !== original.toLowerCase().trim()) {
    hasErrors = true;
  }

  // 6. Compute fine-grained diff tokens with golden highlighting
  const diffTokens = computeWordDiff(original, corrected);

  return {
    original_text: original,
    corrected_text: corrected,
    has_errors: hasErrors || diffTokens.some(t => t.changed),
    diff_tokens: diffTokens
  };
}

/**
 * Force strict re-analysis on a message
 */
export async function reanalyzeGrammarStrictly(text, targetLang = 'pl', nativeLang = 'es', apiKey = '') {
  return performFullGrammarCorrection(text, targetLang, nativeLang, apiKey);
}
