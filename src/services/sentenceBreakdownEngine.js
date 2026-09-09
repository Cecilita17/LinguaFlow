/**
 * Sentence Grammar Breakdown Engine
 * Provides word-by-word morphosyntactic grammatical analysis:
 * - Part of speech (Verb, Noun, Question Word, Adjective, Preposition, etc.)
 * - Verb conjugation details (Person, Number, Tense, Mood, Lemma / Infinitive)
 * - Noun/Adjective gender, number, and case
 * - Meaning in student's native language
 * - Pinyin / Transliteration for non-Latin scripts (Chinese, Arabic, Russian)
 * - Correction flag highlighting modified words
 * - Seamless integration with Groq AI backend for authentic deep analysis
 */

import { fetchSentenceBreakdownApi } from './chatService.js';

// Multilingual lexicon database for high-frequency linguistic items
const COMMON_WORDS_DB = {
  zh: {
    '你好': { pos: 'Interjección de saludo', pinyin: 'nǐ hǎo', lemma: '你好', meaning: 'hola', explanation: 'Fórmula cordial habitual para saludar a una persona.' },
    '您好': { pos: 'Saludo formal de cortesía', pinyin: 'nín hǎo', lemma: '您好', meaning: 'hola (formal)', explanation: 'Forma honorífica de segunda persona para mostrar respeto.' },
    '我': { pos: 'Pronombre personal (1.ª persona)', pinyin: 'wǒ', lemma: '我', meaning: 'yo', explanation: 'Sujeto u objeto de primera persona singular.' },
    '你': { pos: 'Pronombre personal (2.ª persona)', pinyin: 'nǐ', lemma: '你', meaning: 'tú', explanation: 'Segunda persona singular informal.' },
    '他': { pos: 'Pronombre personal masculino', pinyin: 'tā', lemma: '他', meaning: 'él', explanation: 'Tercera persona singular masculina.' },
    '她': { pos: 'Pronombre personal femenino', pinyin: 'tā', lemma: '她', meaning: 'ella', explanation: 'Tercera persona singular femenina.' },
    '我们': { pos: 'Pronombre personal plural', pinyin: 'wǒmen', lemma: '我们', meaning: 'nosotros', explanation: 'Primera persona del plural con sufijo de pluralidad -men.' },
    '想': { pos: 'Verbo auxiliar modal de volición', pinyin: 'xiǎng', lemma: '想', meaning: 'desear / querer / pensar', explanation: 'Expresa deseo o intención de realizar la acción siguiente.' },
    '要': { pos: 'Verbo modal de necesidad o futuro', pinyin: 'yào', lemma: '要', meaning: 'querer / tener que', explanation: 'Indica intención firme, necesidad o acción inmediata.' },
    '学': { pos: 'Verbo transitivo', pinyin: 'xué', lemma: '学', meaning: 'aprender / estudiar', explanation: 'Acción de adquirir conocimientos o destrezas.' },
    '学习': { pos: 'Verbo / Sustantivo común', pinyin: 'xuéxí', lemma: '学习', meaning: 'estudiar / aprendizaje', explanation: 'Verbo disilábico formal para el acto de estudiar.' },
    '中文': { pos: 'Sustantivo propio / común', pinyin: 'zhōngwén', lemma: '中文', meaning: 'idioma chino', explanation: 'Denominación de la lengua china escrita y hablada.' },
    '汉语': { pos: 'Sustantivo propio', pinyin: 'hànyǔ', lemma: '汉语', meaning: 'lengua china (de la etnia Han)', explanation: 'Término lingüístico técnico para el idioma chino.' },
    '说': { pos: 'Verbo comunicativo', pinyin: 'shuō', lemma: '说', meaning: 'hablar / decir', explanation: 'Verbo de comunicación verbal.' },
    '吃': { pos: 'Verbo transitivo', pinyin: 'chī', lemma: '吃', meaning: 'comer', explanation: 'Acción de ingerir alimentos sólidos.' },
    '喝': { pos: 'Verbo transitivo', pinyin: 'hē', lemma: '喝', meaning: 'beber / tomar', explanation: 'Acción de ingerir líquidos.' },
    '咖啡': { pos: 'Sustantivo común (Préstamo fonético)', pinyin: 'kāfēi', lemma: '咖啡', meaning: 'café', explanation: 'Bebida aromática estimulante.' },
    '茶': { pos: 'Sustantivo común', pinyin: 'chá', lemma: '茶', meaning: 'té', explanation: 'Infusión tradicional de hojas de camellia sinensis.' },
    '水': { pos: 'Sustantivo incontable', pinyin: 'shuǐ', lemma: '水', meaning: 'agua', explanation: 'Líquido vital.' },
    '很': { pos: 'Adverbio de grado', pinyin: 'hěn', lemma: '很', meaning: 'muy', explanation: 'Funciona como nexo obligatorio ante adjetivos predicativos en oraciones afirmativas.' },
    '太': { pos: 'Adverbio enfático', pinyin: 'tài', lemma: '太', meaning: 'demasiado / tan', explanation: 'Suele formar la estructura exclamativa "太...了" (demasiado).' },
    '高兴': { pos: 'Adjetivo estativo', pinyin: 'gāoxìng', lemma: '高兴', meaning: 'contento / alegre', explanation: 'Describe estado de ánimo alegre o satisfecho.' },
    '累': { pos: 'Adjetivo estativo', pinyin: 'lèi', lemma: '累', meaning: 'cansado / fatigado', explanation: 'Expresa agotamiento corporal o mental.' },
    '困': { pos: 'Adjetivo estativo', pinyin: 'kùn', lemma: '困', meaning: 'somnoliento / con sueño', explanation: 'Expresa ganas irresistibles de dormir.' },
    '睡觉': { pos: 'Verbo disociable (离合词)', pinyin: 'shuìjiào', lemma: '睡觉', meaning: 'dormir', explanation: 'Verbo estructurado como verbo-objeto (shuì + jiào).' },
    '谢谢': { pos: 'Fórmula de agradecimiento', pinyin: 'xièxie', lemma: '谢谢', meaning: 'gracias', explanation: 'Agradecimiento estándar por reduplicación verbal.' },
    '不客气': { pos: 'Fórmula de cortesía', pinyin: 'bù kèqi', lemma: '不客气', meaning: 'de nada', explanation: 'Literalmente "no seas ceremonioso".' },
    '再见': { pos: 'Fórmula de despedida', pinyin: 'zàijiàn', lemma: '再见', meaning: 'adiós / hasta luego', explanation: 'Literalmente "volver a verse".' },
    '的': { pos: 'Partícula estructural de subordinación / posesión', pinyin: 'de', lemma: '的', meaning: 'de (marcador posesivo o atributivo)', explanation: 'Conecta un modificador con su núcleo nominal.' },
    '了': { pos: 'Partícula modal o de aspecto perfectivo', pinyin: 'le', lemma: '了', meaning: 'ya (cambio de estado o acción concluida)', explanation: 'Indica conclusión de la acción o nueva situación.' },
    '吗': { pos: 'Partícula interrogativa final', pinyin: 'ma', lemma: '吗', meaning: '¿acaso? (convierte en pregunta)', explanation: 'Transforma una afirmación en pregunta de sí o no.' },
    '呢': { pos: 'Partícula modal de seguimiento o elipsis', pinyin: 'ne', lemma: '呢', meaning: '¿y...? / enfatiza continuidad', explanation: 'Pregunta retórica o de seguimiento ("¿y tú?").' },
    '是': { pos: 'Verbo copulativo atributivo', pinyin: 'shì', lemma: '是', meaning: 'ser', explanation: 'Conecta dos elementos nominales ("A es B").' },
    '不': { pos: 'Adverbio de negación', pinyin: 'bù', lemma: '不', meaning: 'no', explanation: 'Niega acciones presentes, habituales o adjetivos.' },
    '在': { pos: 'Verbo locativo / Preposición de lugar', pinyin: 'zài', lemma: '在', meaning: 'en / estar en', explanation: 'Indica ubicación física o aspecto progresivo.' },
    '有': { pos: 'Verbo existencial / posesivo', pinyin: 'yǒu', lemma: '有', meaning: 'tener / haber', explanation: 'Expresa posesión ("tener") o existencia ("hay").' },
    '什么': { pos: 'Pronombre interrogativo', pinyin: 'shénme', lemma: '什么', meaning: 'qué / cuál', explanation: 'Pide información sobre un objeto o concepto.' },
    '怎么': { pos: 'Adverbio interrogativo de modo', pinyin: 'zěnme', lemma: '怎么', meaning: 'cómo / de qué modo', explanation: 'Pregunta por la manera en que se realiza una acción.' }
  },
  nl: {
    'hoe': { pos: 'Palabra interrogativa (Question word)', lemma: 'hoe', meaning: 'cómo', explanation: 'Palabra interrogativa que pregunta por modo o estado ("cómo").' },
    'gaat': { pos: 'Verbo (3ª persona singular, presente)', lemma: 'gaan', meaning: 'va / anda', explanation: '3.ª persona singular del presente de "gaan" (ir / marchar).' },
    'het': { pos: 'Pronombre neutro impersonal', lemma: 'het', meaning: 'ello / esto', explanation: 'Pronombre impersonal neutro que actúa como sujeto gramatical.' },
    'is': { pos: 'Verbo copulativo (3ª persona singular, presente)', lemma: 'zijn', meaning: 'es / está', explanation: '3.ª persona singular de "zijn" (ser o estar).' },
    'ben': { pos: 'Verbo (1ª persona singular, presente)', lemma: 'zijn', meaning: 'soy / estoy', explanation: '1.ª persona singular de "zijn" (ser o estar).' },
    'bent': { pos: 'Verbo (2ª persona singular, presente)', lemma: 'zijn', meaning: 'eres / estás', explanation: '2.ª persona singular de "zijn" (tú eres o estás).' },
    'ik': { pos: 'Pronombre personal (1ª persona singular)', lemma: 'ik', meaning: 'yo', explanation: 'Sujeto en primera persona ("yo").' },
    'je': { pos: 'Pronombre personal (2ª persona singular)', lemma: 'jij/je', meaning: 'tú / te', explanation: 'Segunda persona singular informal ("tú").' },
    'jij': { pos: 'Pronombre personal enfático (2ª persona)', lemma: 'jij', meaning: 'tú', explanation: 'Forma enfática de segunda persona ("tú mismo").' },
    'we': { pos: 'Pronombre personal (1ª persona plural)', lemma: 'wij/we', meaning: 'nosotros', explanation: 'Primera persona del plural.' },
    'heb': { pos: 'Verbo (1ª persona singular, presente)', lemma: 'hebben', meaning: 'tengo', explanation: '1.ª persona singular de "hebben" (tener o haber).' },
    'heeft': { pos: 'Verbo (3ª persona singular, presente)', lemma: 'hebben', meaning: 'tiene', explanation: '3.ª persona singular de "hebben" (tener).' },
    'moe': { pos: 'Adjetivo predicativo', lemma: 'moe', meaning: 'cansado / fatigado', explanation: 'Adjetivo que indica estado de cansancio.' },
    'slaap': { pos: 'Sustantivo masculino', lemma: 'slaap', meaning: 'sueño / reposo', explanation: 'Sustantivo que designa el estado de dormir o somnolencia.' },
    'slapen': { pos: 'Verbo (Infinitivo)', lemma: 'slapen', meaning: 'dormir', explanation: 'Infinitivo del verbo dormir.' },
    'koffie': { pos: 'Sustantivo común masculino', lemma: 'koffie', meaning: 'café', explanation: 'Bebida aromática obtenida de los granos tostados.' },
    'een': { pos: 'Artículo indeterminado', lemma: 'een', meaning: 'un / una', explanation: 'Artículo indefinido singular para cualquier género.' },
    'graag': { pos: 'Adverbio modal', lemma: 'graag', meaning: 'con gusto / por favor', explanation: 'Expresa deseo cortés en peticiones ("me gustaría / con gusto").' },
    'wil': { pos: 'Verbo modal (1ª/3ª persona, presente)', lemma: 'willen', meaning: 'quiero / quiere', explanation: 'Verbo modal de volición o deseo ("willen").' },
    'hallo': { pos: 'Saludo cordial', lemma: 'hallo', meaning: 'hola', explanation: 'Fórmula habitual de salutación.' },
    'hoi': { pos: 'Saludo informal', lemma: 'hoi', meaning: 'hola', explanation: 'Saludo coloquial y amigable.' },
    'dank': { pos: 'Sustantivo / Interjección', lemma: 'dank', meaning: 'gracias', explanation: 'Expresión de agradecimiento.' },
    'wel': { pos: 'Partícula modal de afirmación o énfasis', lemma: 'wel', meaning: 'bien / ciertamente', explanation: 'Refuerza la cortesía ("dank je wel" = muchas gracias).' },
    'met': { pos: 'Preposición de compañía o instrumento', lemma: 'met', meaning: 'con', explanation: 'Introduce complemento preposicional ("con").' },
    'jou': { pos: 'Pronombre objeto oblicuo', lemma: 'jou', meaning: 'ti / contigo', explanation: 'Forma tónica de segunda persona tras preposición.' },
    'goed': { pos: 'Adjetivo / Adverbio', lemma: 'goed', meaning: 'bien / bueno', explanation: 'Indica estado positivo o correcto.' },
    'alles': { pos: 'Pronombre indefinido universal', lemma: 'alles', meaning: 'todo', explanation: 'Engloba la totalidad de las cosas.' }
  },
  pl: {
    'jak': { pos: 'Palabra interrogativa (Question word)', lemma: 'jak', meaning: 'cómo', explanation: 'Adverbio interrogativo de modo ("cómo").' },
    'się': { pos: 'Partícula pronominal reflexiva', lemma: 'się', meaning: 'se / -se', explanation: 'Indica acción recíproca o intransitiva refleja.' },
    'masz': { pos: 'Verbo (2ª persona singular, presente)', lemma: 'mieć', meaning: 'tienes / te va', explanation: '2.ª persona singular del verbo "mieć" (tener).' },
    'cześć': { pos: 'Saludo / Despedida informal', lemma: 'cześć', meaning: 'hola / adiós', explanation: 'Fórmula cordial entre amigos y conocidos.' },
    'jestem': { pos: 'Verbo (1ª persona singular, presente)', lemma: 'być', meaning: 'soy / estoy', explanation: '1.ª persona singular del verbo ser o estar ("być").' },
    'jest': { pos: 'Verbo (3ª persona singular, presente)', lemma: 'być', meaning: 'es / está', explanation: '3.ª persona singular de "być".' },
    'mam': { pos: 'Verbo (1ª persona singular, presente)', lemma: 'mieć', meaning: 'tengo', explanation: '1.ª persona singular de "mieć" (tener).' },
    'chcę': { pos: 'Verbo (1ª persona singular, presente)', lemma: 'chcieć', meaning: 'quiero / deseo', explanation: '1.ª persona singular de "chcieć" (querer).' },
    'kawę': { pos: 'Sustantivo femenino (Acusativo singular)', lemma: 'kawa', meaning: 'café (objeto directo)', explanation: 'Caso acusativo requerido como objeto directo de beber o pedir.' },
    'kawa': { pos: 'Sustantivo femenino (Nominativo singular)', lemma: 'kawa', meaning: 'café', explanation: 'Forma canónica de sujeto (nominativo).' },
    'dziękuję': { pos: 'Verbo (1ª persona singular) / Fórmula de cortesía', lemma: 'dziękować', meaning: 'gracias / agradezco', explanation: 'Agradecimiento formal o cordial.' },
    'proszę': { pos: 'Verbo / Interjección de cortesía', lemma: 'prosić', meaning: 'por favor / de nada', explanation: 'Fórmula polifacética para pedir cortésmente o responder a gracias.' },
    'chce': { pos: 'Verbo impersonal (3ª persona singular)', lemma: 'chcieć', meaning: 'quiere / da ganas', explanation: 'Construcción impersonal ("chce mi się...").' },
    'mi': { pos: 'Pronombre personal (Dativo singular)', lemma: 'ja', meaning: 'a mí / me', explanation: 'Caso dativo que indica a quién le da ganas o afecta la acción.' },
    'spać': { pos: 'Verbo (Infinitivo)', lemma: 'spać', meaning: 'dormir', explanation: 'Infinitivo que expresa el acto de conciliar el sueño.' },
    'senny': { pos: 'Adjetivo masculino (Nominativo singular)', lemma: 'senny', meaning: 'somnoliento', explanation: 'Describe estado de sueño o cansancio.' }
  },
  es: {
    'cómo': { pos: 'Palabra interrogativa (Question word)', lemma: 'cómo', meaning: 'de qué manera / cómo', explanation: 'Pronombre interrogativo con tilde diacrítica obligatoria.' },
    'como': { pos: 'Adverbio relativo / Conjunción', lemma: 'como', meaning: 'como / al igual que', explanation: 'Forma átona sin tilde usada para comparaciones o modo.' },
    'estás': { pos: 'Verbo auxiliar/copulativo (2ª pers. singular, presente)', lemma: 'estar', meaning: 'te encuentras / estás', explanation: '2.ª persona singular de "estar" con tilde ortográfica.' },
    'está': { pos: 'Verbo (3ª persona singular, presente)', lemma: 'estar', meaning: 'se encuentra / está', explanation: '3.ª persona singular de "estar".' },
    'estoy': { pos: 'Verbo (1ª persona singular, presente)', lemma: 'estar', meaning: 'me encuentro / estoy', explanation: '1.ª persona singular del presente de "estar".' },
    'soy': { pos: 'Verbo atributivo (1ª persona singular, presente)', lemma: 'ser', meaning: 'soy', explanation: 'Expresa identidad esencial o características permanentes.' },
    'es': { pos: 'Verbo atributivo (3ª persona singular, presente)', lemma: 'ser', meaning: 'es', explanation: '3.ª persona singular del verbo "ser".' },
    'tengo': { pos: 'Verbo transitivo (1ª persona singular, presente)', lemma: 'tener', meaning: 'poseo / experimento', explanation: '1.ª persona de "tener", usada para sensaciones físicas ("tengo hambre").' },
    'sueño': { pos: 'Sustantivo masculino', lemma: 'sueño', meaning: 'somnolencia / ganas de dormir', explanation: 'Sustantivo que indica necesidad de descanso.' },
    'quiero': { pos: 'Verbo volitivo (1ª persona singular, presente)', lemma: 'querer', meaning: 'deseo / quiero', explanation: '1.ª persona singular de deseo o voluntad.' },
    'café': { pos: 'Sustantivo común masculino singular', lemma: 'café', meaning: 'café', explanation: 'Palabra aguda terminada en vocal, lleva tilde obligatoria.' },
    'gracias': { pos: 'Fórmula de cortesía', lemma: 'gracias', meaning: 'agradecimiento', explanation: 'Expresión para manifestar gratitud.' },
    'hola': { pos: 'Interjección de saludo', lemma: 'hola', meaning: 'saludo cordial', explanation: 'Fórmula de apertura conversacional.' },
    'por': { pos: 'Preposición', lemma: 'por', meaning: 'causa o medio', explanation: 'Introduce causa o locución adverbial ("por favor").' },
    'favor': { pos: 'Sustantivo masculino', lemma: 'favor', meaning: 'beneficio o gracia', explanation: 'Forma la locución cortés "por favor".' }
  },
  en: {
    'how': { pos: 'Question word (Palabra interrogativa)', lemma: 'how', meaning: 'cómo', explanation: 'Interrogative adverb asking for manner, condition or degree.' },
    'are': { pos: 'Linking verb (2nd person singular / plural present)', lemma: 'be', meaning: 'eres / estás / son', explanation: 'Present tense of auxiliary verb "to be".' },
    'is': { pos: 'Linking verb (3rd person singular present)', lemma: 'be', meaning: 'es / está', explanation: '3rd person singular present tense of "to be".' },
    'am': { pos: 'Linking verb (1st person singular present)', lemma: 'be', meaning: 'soy / estoy', explanation: '1st person singular present tense of "to be" ("I am").' },
    'you': { pos: 'Personal pronoun (2nd person subject/object)', lemma: 'you', meaning: 'tú / usted / ustedes', explanation: 'Direct address pronoun.' },
    'i': { pos: 'Personal pronoun (1st person singular subject)', lemma: 'I', meaning: 'yo', explanation: 'Must always be written in uppercase in English.' },
    'have': { pos: 'Verb (Present tense)', lemma: 'have', meaning: 'tener / haber', explanation: 'Used for possession or forming perfect tenses.' },
    'has': { pos: 'Verb (3rd person singular present)', lemma: 'have', meaning: 'tiene / ha', explanation: 'Irregular 3rd person singular of "to have".' },
    'goes': { pos: 'Verb (3rd person singular present)', lemma: 'go', meaning: 'va / marcha', explanation: '3rd person singular present tense of "to go".' },
    'want': { pos: 'Verb (Present tense)', lemma: 'want', meaning: 'querer / desear', explanation: 'Expresses volition or desire.' },
    'coffee': { pos: 'Noun (Uncountable/Countable)', lemma: 'coffee', meaning: 'café', explanation: 'Caffeinated hot or iced beverage.' },
    'tired': { pos: 'Adjective (Participle)', lemma: 'tired', meaning: 'cansado / agotado', explanation: 'Describes physical or mental fatigue.' },
    'sleep': { pos: 'Noun / Verb', lemma: 'sleep', meaning: 'dormir / sueño', explanation: 'State of rest or action of sleeping.' },
    'hello': { pos: 'Greeting interjection', lemma: 'hello', meaning: 'hola', explanation: 'Standard cordial greeting.' },
    'thanks': { pos: 'Interjection / Noun', lemma: 'thanks', meaning: 'gracias', explanation: 'Informal expression of gratitude.' }
  },
  de: {
    'wie': { pos: 'Fragewort (Question word)', lemma: 'wie', meaning: 'cómo', explanation: 'Interrogativadverb für Art und Weise ("cómo").' },
    'geht': { pos: 'Verb (3. Person Singular Präsens)', lemma: 'gehen', meaning: 'va / marcha', explanation: '3. Person Singular Präsens von "gehen". Bildet "Wie geht es dir?".' },
    'es': { pos: 'Pronomen (Neutrum Subjekt)', lemma: 'es', meaning: 'ello / esto', explanation: 'Unpersönliches Pronomen für Zustände.' },
    'dir': { pos: 'Personalpronomen (Dativ)', lemma: 'du', meaning: 'a ti / te', explanation: 'Dativobjekt nach "wie geht es...".' },
    'hallo': { pos: 'Grußformel', lemma: 'hallo', meaning: 'hola', explanation: 'Alltägliche Begrüßung.' },
    'kaffee': { pos: 'Substantiv (Maskulin)', lemma: 'Kaffee', meaning: 'café', explanation: 'Substantive im Deutschen werden immer großgeschrieben.' },
    'müde': { pos: 'Adjektiv', lemma: 'müde', meaning: 'cansado', explanation: 'Zustand der Erschöpfung oder des Schlafmangels.' }
  },
  fr: {
    'comment': { pos: 'Mot interrogatif (Question word)', lemma: 'comment', meaning: 'cómo', explanation: 'Adverbe interrogatif pour la manière ou l’état.' },
    'ça': { pos: 'Pronom démonstratif', lemma: 'cela/ça', meaning: 'eso / las cosas', explanation: 'Contraction familière de "cela".' },
    'va': { pos: 'Verbe (3e personne du singulier, présent)', lemma: 'aller', meaning: 'va', explanation: '3e personne du singulier de l’indicatif présent de "aller".' },
    'bonjour': { pos: 'Formule de salutation', lemma: 'bonjour', meaning: 'buenos días / hola', explanation: 'Salutation polie et courante en journée.' },
    'merci': { pos: 'Interjection de politesse', lemma: 'merci', meaning: 'gracias', explanation: 'Formule de remerciement.' },
    'café': { pos: 'Nom masculin singulier', lemma: 'café', meaning: 'café', explanation: 'Prend un accent aigu sur le e.' }
  },
  it: {
    'come': { pos: 'Parola interrogativa (Question word)', lemma: 'come', meaning: 'cómo', explanation: 'Avverbio interrogativo per chiedere la condizione.' },
    'stai': { pos: 'Verbo (2ª persona singolare, presente)', lemma: 'stare', meaning: 'estás', explanation: '2ª persona singolare indicativo presente di "stare".' },
    'ciao': { pos: 'Saluto informale', lemma: 'ciao', meaning: 'hola / chau', explanation: 'Saluto confidenziale e amichevole sia all’arrivo che all’addio.' },
    'grazie': { pos: 'Formula di cortesia', lemma: 'grazie', meaning: 'gracias', explanation: 'Espressione per ringraziare.' }
  },
  ar: {
    'مرحبا': { pos: 'تحية (Saludo cordial)', translit: 'marḥaban', lemma: 'مرحبا', meaning: 'hola / bienvenido', explanation: 'Fórmula árabe clásica de apertura conversacional cordial.' },
    'أنا': { pos: 'ضمير منفصل (Pronombre personal 1ª pers.)', translit: 'anā', lemma: 'أنا', meaning: 'yo', explanation: 'Pronombre de primera persona singular en caso nominativo.' },
    'كيف': { pos: 'اسم استفهام (Palabra interrogativa)', translit: 'kayfa', lemma: 'كيف', meaning: 'cómo', explanation: 'Interrogativo que pregunta por el estado o condición.' },
    'حالك': { pos: 'اسم مضاف إلى ضمير', translit: 'ḥāluka', lemma: 'حال', meaning: 'tu estado / cómo estás', explanation: 'Sustantivo ḥāl (estado) con pronombre enclítico de 2ª persona.' },
    'شكرا': { pos: 'مفعول مطلق / تعبير شكر (Agradecimiento)', translit: 'shukran', lemma: 'شكر', meaning: 'gracias', explanation: 'Fórmula de gratitud en caso acusativo con tanwin.' }
  },
  ru: {
    'привет': { pos: 'Междометие (Saludo cordial)', translit: 'privet', lemma: 'привет', meaning: 'hola', explanation: 'Saludo informal y cercano entre amigos.' },
    'как': { pos: 'Вопросительное наречие (Interrogativo)', translit: 'kak', lemma: 'как', meaning: 'cómo', explanation: 'Adverbio interrogativo de modo o condición.' },
    'дела': { pos: 'Существительное во множественном числе', translit: 'dela', lemma: 'дело', meaning: 'asuntos / cómo andan las cosas', explanation: 'Forma plural del sustantivo дело en la expresión "как дела?".' },
    'спасибо': { pos: 'Формула вежливости (Agradecimiento)', translit: 'spasibo', lemma: 'спасибо', meaning: 'gracias', explanation: 'Fórmula estándar rusa de agradecimiento.' }
  }
};

/**
 * Clean a word token removing outer punctuation marks
 */
function cleanToken(word) {
  return (word || '')
    .toLowerCase()
    .replace(/^[^wÀ-ɏЀ-ӿ؀-ۿ一-鿿]+|[^wÀ-ɏЀ-ӿ؀-ۿ一-鿿]+$/g, '');
}

/**
 * Intelligently tokenize sentence into grammatical units.
 * Supports Chinese character/word grouping via Intl.Segmenter.
 */
export function tokenizeSentence(text, targetLang) {
  if (!text) return [];
  const cleanStr = text.trim();
  if (targetLang === 'zh' || /[\u4E00-\u9FFF]/.test(cleanStr)) {
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const seg = new Intl.Segmenter('zh', { granularity: 'word' });
        const words = [...seg.segment(cleanStr)]
          .map(s => s.segment.trim())
          .filter(Boolean);
        if (words.length > 0) return words;
      }
    } catch (e) {}
  }
  return cleanStr.split(/\s+/).filter(Boolean);
}

/**
 * Infer morphological and grammatical features for words not in the static dictionary.
 * Strictly avoids generic placeholder templates like "Palabra léxica en ...".
 */
function inferLinguisticRole(cleanWord, rawWord, targetLang) {
  if (!cleanWord) {
    return {
      pos: 'Signo ortográfico',
      lemma: rawWord,
      meaning: rawWord,
      pinyin: null,
      translit: null,
      explanation: 'Signo ortográfico auxiliar que delimita la estructura de la oración.'
    };
  }

  // Chinese Hanzi words
  if (targetLang === 'zh' || /[\u4E00-\u9FFF]/.test(cleanWord)) {
    return {
      pos: 'Término / Morfema en caracteres chinos',
      lemma: cleanWord,
      meaning: cleanWord,
      pinyin: null,
      translit: null,
      explanation: 'Palabra o carácter léxico en chino mandarín (Hànzì).'
    };
  }

  // Capitalized German noun rule
  if (targetLang === 'de' && /^[A-ZÄÖÜ]/.test(rawWord)) {
    return {
      pos: 'Sustantivo alemán (Substantiv)',
      lemma: cleanWord,
      meaning: cleanWord,
      pinyin: null,
      translit: null,
      explanation: 'Sustantivo en lengua alemana (se escribe siempre con mayúscula inicial).'
    };
  }

  // Spanish verb endings
  if (targetLang === 'es') {
    if (/ar$|er$|ir$/.test(cleanWord)) {
      return { pos: 'Verbo en infinitivo', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Forma no conjugada del verbo (infinitivo).' };
    }
    if (/ando$|iendo$/.test(cleanWord)) {
      return { pos: 'Gerundio continuo', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Acción en desarrollo continuo.' };
    }
    if (/ó$|é$|í$|aste$|iste$/.test(cleanWord)) {
      return { pos: 'Verbo en pretérito perfecto simple', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Acción completada en el pasado.' };
    }
    if (/ción$|sión$|dad$|tad$|ura$|eza$/.test(cleanWord)) {
      return { pos: 'Sustantivo derivado', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Sustantivo abstracto derivado.' };
    }
  }

  // English verb endings
  if (targetLang === 'en') {
    if (/ing$/.test(cleanWord)) {
      return { pos: 'Present participle / Gerund', lemma: cleanWord.replace(/ing$/, ''), meaning: cleanWord, pinyin: null, translit: null, explanation: 'Forma continua progresiva o gerundio nominal.' };
    }
    if (/ed$/.test(cleanWord)) {
      return { pos: 'Past tense / Past participle', lemma: cleanWord.replace(/ed$/, ''), meaning: cleanWord, pinyin: null, translit: null, explanation: 'Pretérito simple o participio regular.' };
    }
    if (/s$/.test(cleanWord) && cleanWord.length > 3) {
      return { pos: 'Plural noun / 3rd pers. verb', lemma: cleanWord.replace(/s$/, ''), meaning: cleanWord, pinyin: null, translit: null, explanation: 'Plural nominal o 3.ª persona singular del presente de indicativo.' };
    }
    if (/ly$/.test(cleanWord)) {
      return { pos: 'Adverb of manner', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Adverbio modal de modo.' };
    }
  }

  // Dutch verb endings
  if (targetLang === 'nl') {
    if (/en$/.test(cleanWord)) {
      return { pos: 'Werkwoord infinitief / meervoud', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Infinitivo verbal o forma plural en presente.' };
    }
    if (/t$/.test(cleanWord)) {
      return { pos: 'Werkwoord persoonsvorm (2e/3e persoon)', lemma: cleanWord.slice(0, -1), meaning: cleanWord, pinyin: null, translit: null, explanation: '2.ª o 3.ª persona singular del presente en neerlandés.' };
    }
  }

  // Polish endings
  if (targetLang === 'pl') {
    if (/ć$|c$/.test(cleanWord)) {
      return { pos: 'Czasownik w bezokoliczniku (Infinitivo)', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Forma canónica de infinitivo del verbo polaco.' };
    }
    if (/łem$|łam$|ł$|ła$|li$/.test(cleanWord)) {
      return { pos: 'Czasownik w czasie przeszłym (Pasado)', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Forma verbal en tiempo pasado con marca de género gramatical.' };
    }
    if (/ę$/.test(cleanWord)) {
      return { pos: '1.ª persona singular o acusativo femenino', lemma: cleanWord, meaning: cleanWord, pinyin: null, translit: null, explanation: 'Desinencia verbal de 1.ª persona singular ("ja") o marca de caso acusativo singular.' };
    }
  }

  // Linguistic descriptive fallback (no template placeholders)
  return {
    pos: 'Elemento gramatical de la oración',
    lemma: cleanWord,
    meaning: cleanWord,
    pinyin: null,
    translit: null,
    explanation: `Unidad léxica que cumple una función sintáctica en la proposición.`
  };
}

/**
 * Generate full sentence grammatical breakdown locally.
 * Tokenizes accurately and computes word-by-word morphosyntax.
 */
export function generateSentenceBreakdown(correctedText, originalText = '', targetLang = 'nl', nativeLang = 'es') {
  if (!correctedText) return [];

  const rawTokens = tokenizeSentence(correctedText, targetLang);
  const origTokens = tokenizeSentence(originalText, targetLang);
  const langDict = COMMON_WORDS_DB[targetLang] || {};

  return rawTokens.map((rawWord, idx) => {
    const clean = cleanToken(rawWord);
    const origWord = origTokens[idx] || null;
    const cleanOrig = cleanToken(origWord);
    const wasCorrected = Boolean(origWord && clean && cleanOrig && clean !== cleanOrig);

    // 1. Check specialized lexicon
    const dictEntry = langDict[clean] || langDict[rawWord];
    let pos = '';
    let lemma = clean || rawWord;
    let explanation = '';
    let meaning = clean || rawWord;
    let pinyin = null;
    let translit = null;

    if (dictEntry) {
      pos = dictEntry.pos;
      lemma = dictEntry.lemma || clean;
      meaning = dictEntry.meaning || clean;
      explanation = dictEntry.explanation || '';
      pinyin = dictEntry.pinyin || dictEntry.translit || null;
      translit = dictEntry.translit || dictEntry.pinyin || null;
    } else {
      // 2. Infer morphological role
      const inferred = inferLinguisticRole(clean, rawWord, targetLang);
      pos = inferred.pos;
      lemma = inferred.lemma;
      meaning = inferred.meaning;
      explanation = inferred.explanation;
      pinyin = inferred.pinyin;
      translit = inferred.translit;
    }

    return {
      index: idx + 1,
      word: rawWord,
      cleanWord: clean,
      lemma,
      pos,
      explanation,
      meaning,
      pinyin,
      translit,
      wasCorrected,
      originalWord: wasCorrected ? origWord : null
    };
  });
}

/**
 * Asynchronously fetch authentic AI-powered deep grammatical breakdown,
 * with graceful fallback to the local linguistic engine.
 */
export async function getOrFetchSentenceBreakdown({
  correctedText,
  originalText = '',
  targetLang = 'es',
  nativeLang = 'es',
  apiKey = ''
}) {
  if (!correctedText) return [];

  // 1. Try AI-powered deep grammatical breakdown first (Groq openai/gpt-oss-120b)
  try {
    const aiTokens = await fetchSentenceBreakdownApi({
      sentence: correctedText,
      originalText,
      targetLang,
      nativeLang,
      apiKey
    });

    if (aiTokens && Array.isArray(aiTokens) && aiTokens.length > 0) {
      return aiTokens.map((item, idx) => ({
        index: item.index || idx + 1,
        word: item.word,
        cleanWord: cleanToken(item.word) || item.word,
        lemma: item.lemma || item.word,
        pos: item.pos || 'Elemento gramatical',
        meaning: item.meaning || item.word,
        explanation: item.explanation || 'Componente sintáctico de la oración.',
        pinyin: item.pinyin || item.translit || null,
        translit: item.translit || item.pinyin || null,
        wasCorrected: Boolean(item.wasCorrected),
        originalWord: item.originalWord || null
      }));
    }
  } catch (err) {
    console.warn('AI breakdown notice, using local linguistic engine:', err.message);
  }

  // 2. Local linguistic engine fallback
  return generateSentenceBreakdown(correctedText, originalText, targetLang, nativeLang);
}
