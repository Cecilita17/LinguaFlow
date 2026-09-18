import { computeWordDiff } from './diffUtils.js';
import { getArabicTransliteration } from './arabicTransliteration.js';
import { getEffectiveApiKey } from './subtitleGlossService.js';
import { API_BASE_URL } from './chatService.js';

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
  ar: 'ar',
  tr: 'tr-TR'
};

/**
 * Cross-language translations for common learner phrases
 * (When the user types in Spanish while practicing another target language)
 */
const SPANISH_CROSS_CORRECTIONS = {
  tr: [
    { regex: /\b(hola|buenas|buen d[ií]a|buenos d[ií]as)\b/gi, replacement: 'Merhaba!', orig: 'hola' },
    { regex: /\b(c[oó]mo est[aá]s|qu[eé] tal)\b/gi, replacement: 'Nasılsın?', orig: 'cómo estás' },
    { regex: /\b(tengo sue[nñ]o|tengo sue[nñ]ito)\b/gi, replacement: 'Uykum var', orig: 'tengo sueño' },
    { regex: /\b(quiero caf[eé]|un caf[eé] por favor)\b/gi, replacement: 'Bir kahve istiyorum, lütfen', orig: 'quiero café' },
    { regex: /\b(gracias|muchas gracias)\b/gi, replacement: 'Çok teşekkür ederim!', orig: 'gracias' },
    { regex: /\b(por favor)\b/gi, replacement: 'Lütfen', orig: 'por favor' },
    { regex: /\b(adi[oó]s|chau|hasta luego)\b/gi, replacement: 'Hoşça kal! / Görüşürüz!', orig: 'adiós' },
    { regex: /\b(me llamo|mi nombre es)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/gi, replacement: 'Benim adım $2', orig: 'me llamo' },
    { regex: /\b(soy de|vengo de)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/gi, replacement: '$2\'dan geliyorum', orig: 'soy de' },
    { regex: /\b(no entiendo|no comprendo)\b/gi, replacement: 'Anlamıyorum', orig: 'no entiendo' }
  ],
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
    'un': 'een', 'una': 'een', 'bebe': 'baby', 'bebé': 'baby', 'bebes': 'baby\'s', 'bebés': 'baby\'s',
    'nino': 'jongen', 'niño': 'jongen', 'nina': 'meisje', 'niña': 'meisje', 'hijo': 'zoon', 'hija': 'dochter', 'hijos': 'kinderen',
    'padre': 'vader', 'madre': 'moeder', 'papa': 'vader', 'mama': 'moeder', 'papá': 'vader', 'mamá': 'moeder',
    'hermano': 'broer', 'hermana': 'zus', 'familia': 'familie', 'perro': 'hond', 'gato': 'kat', 'coche': 'auto', 'carro': 'auto',
    'trabajo': 'werk', 'dinero': 'geld', 'escuela': 'school',
    'very': 'erg', 'tired': 'moe', 'cansado': 'moe', 'cansada': 'moe',
    'happy': 'blij', 'feliz': 'blij', 'sad': 'verdrietig', 'triste': 'verdrietig',
    'good': 'goed', 'bueno': 'goed', 'bien': 'goed', 'bad': 'slecht', 'malo': 'slecht', 'mal': 'slecht',
    'big': 'groot', 'grande': 'groot', 'small': 'klein', 'pequeño': 'klein', 'pequeña': 'klein',
    'please': 'alstublieft', 'thanks': 'bedankt', 'thank': 'bedankt', 'gracias': 'bedankt',
    'hello': 'hallo', 'hola': 'hallo', 'bye': 'dag', 'adiós': 'dag', 'adios': 'dag',
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
    'agua': 'water',
    'café': 'koffie', 'cafe': 'koffie', 'coffee': 'koffie',
    'té': 'thee', 'tea': 'thee',
    'azúcar': 'suiker', 'azucar': 'suiker', 'sugar': 'suiker',
    'sal': 'zout', 'salt': 'zout',
    'pimienta': 'peper', 'pepper': 'peper',
    'aceite': 'olie', 'oil': 'olie',
    'mantequilla': 'boter', 'butter': 'boter',
    'fruta': 'fruit', 'frutas': 'fruit',
    'manzana': 'appel', 'manzanas': 'appels', 'apple': 'appel', 'apples': 'appels',
    'papa': 'aardappel', 'papas': 'aardappels', 'patata': 'aardappel', 'patatas': 'aardappels', 'potato': 'aardappel', 'potatoes': 'aardappels',
    'cebolla': 'ui', 'cebollas': 'uien', 'onion': 'ui', 'onions': 'uien',
    'tomate': 'tomaat', 'tomates': 'tomaten', 'tomato': 'tomaat', 'tomatoes': 'tomaten',
    'ajo': 'knoflook', 'garlic': 'knoflook',
    'zanahoria': 'wortel', 'zanahorias': 'wortelen', 'carrot': 'wortel', 'carrots': 'wortels',
    'con': 'met', 'with': 'met',
    'sin': 'zonder', 'without': 'zonder',
    'para': 'voor', 'for': 'voor',
    'from': 'van',
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
    'ayer': 'gisteren', 'yesterday': 'gisteren',
    'quiero': 'ik wil', 'tengo': 'ik heb', 'necesito': 'ik heb nodig'
  },
  de: {
    'sopa': 'Suppe', 'sopas': 'Suppen', 'soup': 'Suppe',
    'verdura': 'Gemüse', 'verduras': 'Gemüse', 'vegetales': 'Gemüse', 'vegetable': 'Gemüse', 'vegetables': 'Gemüse',
    'comida': 'Essen', 'food': 'Essen',
    'carne': 'Fleisch', 'meat': 'Fleisch',
    'pollo': 'Hähnchen', 'chicken': 'Hähnchen',
    'pescado': 'Fisch', 'fish': 'Fisch',
    'arroz': 'Reis', 'rice': 'Reis',
    'pan': 'Brot', 'bread': 'Brot',
    'queso': 'Käse', 'cheese': 'Käse',
    'huevo': 'Ei', 'huevos': 'Eier', 'egg': 'Ei', 'eggs': 'Eier',
    'leche': 'Milch', 'milk': 'Milch',
    'agua': 'Wasser', 'water': 'Wasser',
    'café': 'Kaffee', 'cafe': 'Kaffee', 'coffee': 'Kaffee',
    'té': 'Tee', 'te': 'Tee', 'tea': 'Tee',
    'azúcar': 'Zucker', 'azucar': 'Zucker', 'sugar': 'Zucker',
    'sal': 'Salz', 'salt': 'Salz',
    'pimienta': 'Pfeffer', 'pepper': 'Pfeffer',
    'aceite': 'Öl', 'oil': 'Öl',
    'mantequilla': 'Butter', 'butter': 'Butter',
    'fruta': 'Obst', 'frutas': 'Früchte', 'fruit': 'Obst',
    'manzana': 'Apfel', 'manzanas': 'Äpfel', 'apple': 'Apfel', 'apples': 'Äpfel',
    'papa': 'Kartoffel', 'papas': 'Kartoffeln', 'patata': 'Kartoffel', 'patatas': 'Kartoffeln', 'potato': 'Kartoffel', 'potatoes': 'Kartoffeln',
    'cebolla': 'Zwiebel', 'cebollas': 'Zwiebeln', 'onion': 'Zwiebel', 'onions': 'Zwiebeln',
    'tomate': 'Tomate', 'tomates': 'Tomaten', 'tomato': 'Tomate', 'tomatoes': 'Tomaten',
    'ajo': 'Knoblauch', 'garlic': 'Knoblauch',
    'con': 'mit', 'with': 'mit',
    'sin': 'ohne', 'without': 'ohne',
    'para': 'für', 'for': 'für',
    'y': 'und', 'and': 'und',
    'o': 'oder', 'or': 'oder',
    'pero': 'aber', 'but': 'aber',
    'porque': 'weil', 'because': 'weil',
    'hacer': 'machen', 'make': 'machen',
    'cocinar': 'kochen', 'cook': 'kochen',
    'comer': 'essen', 'eat': 'essen',
    'beber': 'trinken', 'tomar': 'trinken', 'drink': 'trinken',
    'casa': 'Haus', 'house': 'Haus',
    'amigo': 'Freund', 'amiga': 'Freundin', 'amigos': 'Freunde', 'friend': 'Freund',
    'libro': 'Buch', 'libros': 'Bücher', 'book': 'Buch',
    'ciudad': 'Stadt', 'city': 'Stadt',
    'país': 'Land', 'pais': 'Land', 'country': 'Land',
    'tiempo': 'Zeit', 'time': 'Zeit',
    'hoy': 'heute', 'today': 'heute',
    'mañana': 'morgen', 'tomorrow': 'morgen',
    'ayer': 'gestern', 'yesterday': 'gestern',
    'quiero': 'will', 'tengo': 'habe', 'necesito': 'brauche'
  },
  en: {
    'sopa': 'soup', 'sopas': 'soups',
    'verdura': 'vegetable', 'verduras': 'vegetables', 'vegetales': 'vegetables',
    'comida': 'food',
    'carne': 'meat',
    'pollo': 'chicken',
    'pescado': 'fish',
    'arroz': 'rice',
    'pan': 'bread',
    'queso': 'cheese',
    'huevo': 'egg', 'huevos': 'eggs',
    'leche': 'milk',
    'agua': 'water',
    'café': 'coffee', 'cafe': 'coffee',
    'té': 'tea', 'te': 'tea',
    'azúcar': 'sugar', 'azucar': 'sugar',
    'sal': 'salt',
    'pimienta': 'pepper',
    'aceite': 'oil',
    'mantequilla': 'butter',
    'fruta': 'fruit', 'frutas': 'fruits',
    'manzana': 'apple', 'manzanas': 'apples',
    'papa': 'potato', 'papas': 'potatoes', 'patata': 'potato', 'patatas': 'potatoes',
    'cebolla': 'onion', 'cebollas': 'onions',
    'tomate': 'tomato', 'tomates': 'tomatoes',
    'ajo': 'garlic',
    'con': 'with',
    'sin': 'without',
    'para': 'for',
    'y': 'and',
    'o': 'or',
    'pero': 'but',
    'porque': 'because',
    'hacer': 'make',
    'cocinar': 'cook',
    'comer': 'eat',
    'beber': 'drink', 'tomar': 'drink',
    'casa': 'house', 'casas': 'houses',
    'amigo': 'friend', 'amiga': 'friend', 'amigos': 'friends',
    'libro': 'book', 'libros': 'books',
    'perro': 'dog', 'perros': 'dogs',
    'gato': 'cat', 'gatos': 'cats',
    'mesa': 'table', 'mesas': 'tables',
    'silla': 'chair', 'sillas': 'chairs',
    'puerta': 'door', 'puertas': 'doors',
    'ventana': 'window', 'ventanas': 'windows',
    'ciudad': 'city', 'ciudades': 'cities',
    'país': 'country', 'pais': 'country',
    'tiempo': 'time',
    'hora': 'hour', 'horas': 'hours',
    'día': 'day', 'dia': 'day', 'días': 'days',
    'noche': 'night', 'noches': 'nights',
    'mañana': 'morning', 'mañanas': 'mornings',
    'tarde': 'afternoon', 'tardes': 'afternoons',
    'hoy': 'today',
    'ayer': 'yesterday',
    'familia': 'family',
    'hermano': 'brother', 'hermanos': 'brothers',
    'hermana': 'sister', 'hermanas': 'sisters',
    'padre': 'father', 'madre': 'mother',
    'hijo': 'son', 'hija': 'daughter',
    'coche': 'car', 'auto': 'car',
    'quiero': 'want', 'tengo': 'have', 'necesito': 'need',
    'bueno': 'good', 'buena': 'good', 'malo': 'bad', 'mala': 'bad',
    'grande': 'big', 'pequeño': 'small', 'pequeña': 'small',
    'feliz': 'happy', 'cansado': 'tired', 'cansada': 'tired',
    'gracias': 'thank you', 'hola': 'hello', 'adiós': 'goodbye', 'adios': 'goodbye', 'por favor': 'please'
  },
  zh: {
    'sopa': '汤', 'soup': '汤',
    'verduras': '蔬菜', 'vegetales': '蔬菜', 'vegetables': '蔬菜',
    'comida': '食物', 'food': '食物',
    'carne': '肉', 'meat': '肉',
    'pollo': '鸡肉', 'chicken': '鸡肉',
    'pescado': '鱼', 'fish': '鱼',
    'arroz': '米饭', 'rice': '米饭',
    'pan': '面包', 'bread': '面包',
    'queso': '奶酪', 'cheese': '奶酪',
    'huevo': '鸡蛋', 'egg': '鸡蛋',
    'leche': '牛奶', 'milk': '牛奶',
    'agua': '水', 'water': '水',
    'café': '咖啡', 'cafe': '咖啡', 'coffee': '咖啡',
    'té': '茶', 'te': '茶', 'tea': '茶',
    'azúcar': '糖', 'sugar': '糖',
    'fruta': '水果', 'fruit': '水果',
    'manzana': '苹果', 'apple': '苹果',
    'papa': '土豆', 'potato': '土豆',
    'casa': '家', 'house': '家',
    'amigo': '朋友', 'amiga': '朋友', 'friend': '朋友',
    'libro': '书', 'book': '书',
    'perro': '狗', 'dog': '狗',
    'gato': '猫', 'cat': '猫',
    'mesa': '桌子', 'table': '桌子',
    'silla': '椅子', 'chair': '椅子',
    'ciudad': '城市', 'city': '城市',
    'país': '国家', 'pais': '国家', 'country': '国家',
    'escuela': '学校', 'school': '学校',
    'trabajo': '工作', 'work': '工作',
    'dinero': '钱', 'money': '钱',
    'tiempo': '时间', 'time': '时间',
    'hoy': '今天', 'today': '今天',
    'mañana': '明天', 'tomorrow': '明天',
    'ayer': '昨天', 'yesterday': '昨天',
    'con': '和', 'with': '和',
    'sin': '没有', 'without': '没有',
    'para': '给', 'for': '给',
    'hacer': '做', 'make': '做',
    'cocinar': '做饭', 'cook': '做饭',
    'comer': '吃', 'eat': '吃',
    'beber': '喝', 'tomar': '喝', 'drink': '喝',
    'quiero': '想', 'tengo': '有', 'necesito': '需要',
    'bueno': '好', 'malo': '坏', 'grande': '大', 'pequeño': '小',
    'gracias': '谢谢', 'hola': '你好', 'adiós': '再见'
  },
  ar: {
    'sopa': 'حَسَاء', 'soup': 'حَسَاء',
    'verduras': 'خُضْرَاوَات', 'vegetables': 'خُضْرَاوَات',
    'comida': 'طَعَام', 'food': 'طَعَام',
    'carne': 'لَحْم', 'meat': 'لَحْم',
    'pollo': 'دَجَاج', 'chicken': 'دَجَاج',
    'pescado': 'سَمَك', 'fish': 'سَمَك',
    'arroz': 'أَرُزّ', 'rice': 'أَرُزّ',
    'pan': 'خُبْز', 'bread': 'خُبْز',
    'queso': 'جُبْن', 'cheese': 'جُبْن',
    'huevo': 'بَيْض', 'egg': 'بَيْض',
    'leche': 'حَلِيب', 'milk': 'حَلِيب',
    'agua': 'مَاء', 'water': 'مَاء',
    'café': 'قَهْوَة', 'cafe': 'قَهْوَة', 'coffee': 'قَهْوَة',
    'té': 'شَاي', 'te': 'شَاي', 'tea': 'شَاي',
    'azúcar': 'سُكَّر', 'sugar': 'سُكَّر',
    'casa': 'بَيْت', 'house': 'بَيْت',
    'amigo': 'صَدِيق', 'amiga': 'صَدِيقَة', 'friend': 'صَدِيق',
    'libro': 'كِتَاب', 'book': 'كِتَاب',
    'perro': 'كَلْب', 'dog': 'كَلْب',
    'gato': 'قِطّ', 'cat': 'قِطّ',
    'ciudad': 'مَدِينَة', 'city': 'مَدِينَة',
    'país': 'بَلَد', 'country': 'بَلَد',
    'escuela': 'مَدْرَسَة', 'school': 'مَدْرَسَة',
    'trabajo': 'عَمَل', 'work': 'عَمَل',
    'dinero': 'مَال', 'money': 'مَال',
    'tiempo': 'وَقْت', 'time': 'وَقْت',
    'hoy': 'اليَوْم', 'today': 'اليَوْم',
    'ayer': 'أَمْس', 'yesterday': 'أَمْس',
    'con': 'مَعَ', 'with': 'مَعَ',
    'sin': 'بِدُونِ', 'without': 'بِدُونِ',
    'hacer': 'أَفْعَل', 'make': 'أَفْعَل',
    'cocinar': 'أَطْبُخ', 'cook': 'أَطْبُخ',
    'comer': 'آكُل', 'eat': 'آكُل',
    'beber': 'أَشْرَب', 'tomar': 'أَشْرَب', 'drink': 'أَشْرَب',
    'quiero': 'أُرِيدُ', 'tengo': 'عِنْدِي', 'necesito': 'أَحْتَاجُ',
    'gracias': 'شُكْرًا', 'hola': 'مَرْحَبًا', 'adiós': 'مَعَ السَّلَامَة'
  },
  pl: {
    'sopa': 'zupę', 'soup': 'zupę',
    'verduras': 'warzywa', 'vegetales': 'warzywa', 'vegetables': 'warzywa',
    'carne': 'mięso', 'meat': 'mięso',
    'pollo': 'kurczaka', 'chicken': 'kurczaka',
    'pescado': 'rybę', 'fish': 'rybę',
    'arroz': 'ryż', 'rice': 'ryż',
    'pan': 'chleb', 'bread': 'chleb',
    'queso': 'ser', 'cheese': 'ser',
    'huevo': 'jajko', 'egg': 'jajko',
    'leche': 'mleko', 'milk': 'mleko',
    'agua': 'wodę', 'water': 'wodę',
    'café': 'kawę', 'cafe': 'kawę', 'coffee': 'kawę',
    'té': 'herbatę', 'tea': 'herbatę',
    'azúcar': 'cukier', 'sugar': 'cukier',
    'con': 'z', 'with': 'z',
    'sin': 'bez', 'without': 'bez',
    'para': 'dla', 'for': 'dla',
    'y': 'i', 'and': 'i',
    'pero': 'ale', 'but': 'ale',
    'hacer': 'robić', 'cocinar': 'gotować', 'comer': 'jeść', 'beber': 'pić', 'tomar': 'pić',
    'casa': 'dom', 'house': 'dom',
    'amigo': 'przyjaciel', 'friend': 'przyjaciel',
    'libro': 'książkę', 'book': 'książkę',
    'quiero': 'chcę', 'tengo': 'mam', 'necesito': 'potrzebuję'
  },
  fr: {
    'sopa': 'soupe', 'soup': 'soupe',
    'verduras': 'légumes', 'vegetables': 'légumes',
    'carne': 'viande', 'meat': 'viande',
    'pollo': 'poulet', 'chicken': 'poulet',
    'pescado': 'poisson', 'fish': 'poisson',
    'arroz': 'riz', 'rice': 'riz',
    'pan': 'pain', 'bread': 'pain',
    'queso': 'fromage', 'cheese': 'fromage',
    'huevo': 'œuf', 'egg': 'œuf',
    'leche': 'lait', 'milk': 'lait',
    'agua': 'eau', 'water': 'eau',
    'café': 'café', 'cafe': 'café', 'coffee': 'café',
    'té': 'thé', 'tea': 'thé',
    'azúcar': 'sucre', 'sugar': 'sucre',
    'con': 'avec', 'with': 'avec',
    'sin': 'sans', 'without': 'sans',
    'para': 'pour', 'for': 'pour',
    'y': 'et', 'and': 'et',
    'pero': 'mais', 'but': 'mais',
    'hacer': 'faire', 'cocinar': 'cuisiner', 'comer': 'manger', 'beber': 'boire',
    'casa': 'maison', 'house': 'maison',
    'amigo': 'ami', 'friend': 'ami',
    'libro': 'livre', 'book': 'livre'
  },
  it: {
    'sopa': 'zuppa', 'soup': 'zuppa',
    'verduras': 'verdure', 'vegetables': 'verdure',
    'carne': 'carne', 'meat': 'carne',
    'pollo': 'pollo', 'chicken': 'pollo',
    'pescado': 'pesce', 'fish': 'pesce',
    'arroz': 'riso', 'rice': 'riso',
    'pan': 'pane', 'bread': 'pane',
    'queso': 'formaggio', 'cheese': 'formaggio',
    'huevo': 'uovo', 'egg': 'uovo',
    'leche': 'latte', 'milk': 'latte',
    'agua': 'acqua', 'water': 'acqua',
    'café': 'caffè', 'cafe': 'caffè', 'coffee': 'caffè',
    'té': 'tè', 'tea': 'tè',
    'azúcar': 'zucchero', 'sugar': 'zucchero',
    'con': 'con', 'with': 'con',
    'sin': 'senza', 'without': 'senza',
    'para': 'per', 'for': 'per',
    'y': 'e', 'and': 'e',
    'pero': 'ma', 'but': 'ma',
    'hacer': 'fare', 'cocinar': 'cucinare', 'comer': 'mangiare', 'beber': 'bere',
    'casa': 'casa', 'house': 'casa',
    'amigo': 'amico', 'friend': 'amico',
    'libro': 'libro', 'book': 'libro'
  },
  ru: {
    'sopa': 'суп', 'soup': 'суп',
    'verduras': 'овощи', 'vegetables': 'овощи',
    'carne': 'мясо', 'meat': 'мясо',
    'agua': 'воду', 'water': 'воду',
    'café': 'кофе', 'coffee': 'кофе',
    'leche': 'молоко', 'milk': 'молоко',
    'pan': 'хлеб', 'bread': 'хлеб',
    'con': 'с', 'with': 'с',
    'sin': 'без', 'without': 'без',
    'hacer': 'делать', 'cocinar': 'готовить', 'comer': 'есть', 'beber': 'пить',
    'casa': 'дом', 'house': 'дом',
    'amigo': 'друг', 'friend': 'друг',
    'libro': 'книгу', 'book': 'книгу'
  },
  tr: {
    'sopa': 'çorba', 'soup': 'çorba',
    'verduras': 'sebze', 'vegetables': 'sebze',
    'carne': 'et', 'meat': 'et',
    'pollo': 'tavuk', 'chicken': 'tavuk',
    'pescado': 'balık', 'fish': 'balık',
    'arroz': 'pirinç', 'rice': 'pirinç',
    'pan': 'ekmek', 'bread': 'ekmek',
    'queso': 'peynir', 'cheese': 'peynir',
    'huevo': 'yumurta', 'egg': 'yumurta',
    'leche': 'süt', 'milk': 'süt',
    'agua': 'su', 'water': 'su',
    'café': 'kahve', 'cafe': 'kahve', 'coffee': 'kahve',
    'té': 'çay', 'tea': 'çay',
    'azúcar': 'şeker', 'sugar': 'şeker',
    'con': 'ile', 'with': 'ile',
    'sin': 'olmadan', 'without': 'olmadan',
    'para': 'için', 'for': 'için',
    'y': 've', 'and': 've',
    'pero': 'ama', 'but': 'ama',
    'hacer': 'yapmak', 'cocinar': 'pişirmek', 'comer': 'yemek', 'beber': 'içmek',
    'casa': 'ev', 'house': 'ev',
    'amigo': 'arkadaş', 'friend': 'arkadaş',
    'libro': 'kitap', 'book': 'kitap'
  },
  es: {
    'soup': 'sopa', 'vegetables': 'verduras', 'meat': 'carne', 'chicken': 'pollo',
    'water': 'agua', 'coffee': 'café', 'tea': 'té', 'milk': 'leche', 'bread': 'pan',
    'cheese': 'queso', 'egg': 'huevo', 'fruit': 'fruta', 'apple': 'manzana',
    'house': 'casa', 'friend': 'amigo', 'book': 'libro', 'dog': 'perro', 'cat': 'gato',
    'with': 'con', 'without': 'sin', 'make': 'hacer', 'cook': 'cocinar', 'eat': 'comer', 'drink': 'beber'
  }
};

/**
 * Protected valid words per target language that must NEVER be translated away.
 */
export const VALID_TARGET_WORDS = {
  en: new Set(['no', 'in', 'me', 'so', 'to', 'or', 'he', 'be', 'on', 'at', 'by', 'do', 'go', 'if', 'is', 'it', 'my', 'up', 'us', 'we', 'am', 'an', 'as', 'was', 'had', 'were', 'been', 'hotel', 'radio', 'taxi', 'bar', 'club', 'piano', 'solo', 'idea', 'bus', 'pasta', 'auto', 'menu', 'video', 'banana', 'mango', 'actor', 'doctor', 'motor', 'animal', 'hospital', 'canal', 'legal', 'general', 'natural', 'normal', 'total', 'original', 'simple', 'terrible', 'flexible', 'probable', 'visible', 'cable', 'base', 'balance', 'dance', 'chance', 'distance', 'substance', 'perfume', 'costume', 'crime', 'drama', 'flora', 'fauna', 'opera', 'panorama', 'plasma', 'sofa', 'arena', 'cafeteria', 'camera', 'dilemma', 'gorilla', 'lava', 'umbrella', 'vanilla', 'zebra', 'area', 'era', 'extra', 'formula', 'guerrilla', 'inertia', 'agenda', 'propaganda', 'villa', 'yoga']),
  de: new Set(['no', 'in', 'an', 'am', 'so', 'du', 'die', 'der', 'das', 'den', 'dem', 'des', 'er', 'es', 'sie', 'wir', 'ihr', 'ist', 'im', 'ja', 'ab', 'aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu', 'gut', 'neu', 'alt', 'rot', 'blau', 'grün', 'weiß', 'schwarz', 'hotel', 'radio', 'taxi', 'bar', 'club', 'piano', 'solo', 'idea', 'bus', 'pasta', 'auto', 'menu', 'video']),
  nl: new Set(['in', 'en', 'is', 'ik', 'je', 'ze', 'we', 'er', 'te', 'om', 'op', 'van', 'tot', 'bij', 'na', 'uit', 'als', 'dan', 'ook', 'nog', 'al', 'wel', 'niet', 'geen', 'maar', 'want', 'of', 'dus', 'ja', 'nee', 'goed', 'was', 'had', 'ben', 'moe', 'hotel', 'radio', 'taxi', 'bar', 'club', 'piano', 'solo', 'bus', 'pasta', 'auto', 'menu', 'video']),
  pl: new Set(['no', 'w', 'z', 'o', 'do', 'na', 'po', 'od', 'za', 'ze', 'ku', 'ja', 'ty', 'on', 'ona', 'ono', 'my', 'wy', 'oni', 'one', 'to', 'jest', 'są', 'mam', 'ma', 'tak', 'nie', 'ale', 'lub', 'czy', 'hotel', 'radio', 'taxi', 'bar', 'club', 'piano', 'solo', 'bus', 'pasta', 'auto', 'menu', 'video']),
  es: new Set(['no', 'si', 'sí', 'en', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'con', 'sin', 'por', 'para', 'hotel', 'radio', 'taxi', 'bar', 'club', 'piano', 'solo', 'idea', 'bus', 'pasta', 'auto', 'menu', 'video'])
};

/**
 * Translate native vocabulary words mixed inside the sentence (Code-Switching)
 */
export function translateMixedNativeVocabulary(text, targetLang = 'nl') {
  if (!text) return text;
  const langLex = CODE_SWITCHING_LEXICON[targetLang];
  if (!langLex) return text;
  const protectedWords = VALID_TARGET_WORDS[targetLang] || new Set();

  let result = text.replace(/[\p{L}]+/gu, (match) => {
    const lower = match.toLowerCase();
    // Protect valid target language words
    if (protectedWords.has(lower)) {
      return match;
    }
    if (langLex[lower]) {
      const translated = langLex[lower];
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return translated.charAt(0).toUpperCase() + translated.slice(1);
      }
      return translated;
    }
    return match;
  });

  if (targetLang === 'zh' || targetLang === 'ja') {
    result = result.replace(/([\u4e00-\u9fa5\u3040-\u30ff])\s+([\u4e00-\u9fa5\u3040-\u30ff])/g, '$1$2');
  }

  return result;
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
    { regex: /\bik\s+heb\s+(?:gisteren\s+)?(?:naar\s+de\s+winkel\s+)?gaan\b/gi, replacement: 'ik ben gisteren naar de winkel gegaan' },
    { regex: /\b(toen|omdat|als|wanneer)\s+ik\s+(was|ben|had)\s+(\d+|\w+)\b/gi, replacement: '$1 ik $3 $2' },
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
    { regex: /你好吗/g, replacement: '你好，最近怎么样？' },
    { regex: /\b(ni\s*hao\s*,\s*ni\s*hao\s*ma\??)\b/gi, replacement: '你好，你好吗？' },
    { regex: /\b(ni\s*hao\s*ma\??)\b/gi, replacement: '你好吗？' },
    { regex: /\b(ni\s*hao)\b/gi, replacement: '你好' }
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
  const rawDiffTokens = computeWordDiff(original, corrected);
  const isArabic = targetLang === 'ar';

  const diffTokens = rawDiffTokens.map(token => {
    const wordText = token.text || '';
    if ((isArabic || /[\u0600-\u06FF]/.test(wordText)) && !token.translit) {
      return {
        ...token,
        translit: getArabicTransliteration(wordText)
      };
    }
    return token;
  });

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
export async function reanalyzeGrammarStrictly(text, targetLang = 'pl', nativeLang = 'es', apiKey = '', provider = '') {
  return performFullGrammarCorrection(text, targetLang, nativeLang, apiKey, provider);
}

/**
 * Specialized pedagogical correction helper for Live Calls.
 * Queries the dedicated, lightweight /api/pedagogical-correct endpoint (Groq openai/gpt-oss-120b).
 * If unavailable or times out, seamlessly falls back to LanguageTool + deterministic grammar engine.
 */
export async function getLiveCallPedagogicalCorrection(text, targetLang = 'en', nativeLang = 'es', level = 'A2/B1', apiKey = '') {
  const clean = (text || '').trim();
  if (!clean) {
    return {
      original_text: '',
      corrected_text: '',
      has_errors: false,
      diff_tokens: []
    };
  }

  const effectiveKey = getEffectiveApiKey(apiKey);

  // 1. Attempt lightweight pedagogical correction via dedicated /api/pedagogical-correct
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let res = await fetch(`${API_BASE_URL}/api/pedagogical-correct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(effectiveKey ? { 'x-api-key': effectiveKey } : {})
      },
      body: JSON.stringify({
        text: clean,
        targetLang,
        nativeLang,
        level,
        apiKey: effectiveKey
      }),
      signal: controller.signal
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(`${API_BASE_URL}/pedagogical-correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveKey ? { 'x-api-key': effectiveKey } : {})
        },
        body: JSON.stringify({
          text: clean,
          targetLang,
          nativeLang,
          level,
          apiKey: effectiveKey
        }),
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const isFallback = json && (json.fallback === true || json.success === false);
      const cor = json?.data || json?.user_correction;

      if (cor && !isFallback && (cor.corrected_text !== undefined || cor.diff_tokens)) {
        const corrected = (cor.corrected_text || clean).trim();
        const hasDiffTokens = Array.isArray(cor.diff_tokens) && cor.diff_tokens.length > 0;

        const diffTokens = hasDiffTokens
          ? cor.diff_tokens
          : computeWordDiff(clean, corrected);

        const hasErrors = Boolean(
          cor.has_errors ||
          diffTokens.some((t) => t.changed) ||
          corrected.toLowerCase() !== clean.toLowerCase()
        );

        return {
          original_text: cor.original_text || clean,
          corrected_text: corrected,
          has_errors: hasErrors,
          diff_tokens: diffTokens
        };
      }
    }
  } catch (e) {
    // Graceful fallback to deterministic correction
  }

  // 2. Deterministic linguistic rules & LanguageTool fallback
  return performFullGrammarCorrection(clean, targetLang, nativeLang, effectiveKey);
}

/**
 * Master pedagogical correction helper.
 * Delegates to getLiveCallPedagogicalCorrection with guaranteed fallback.
 */
export async function getPedagogicalCorrection(text, targetLang = 'en', nativeLang = 'es', level = 'A2/B1') {
  return getLiveCallPedagogicalCorrection(text, targetLang, nativeLang, level);
}
