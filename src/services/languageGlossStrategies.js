/**
 * Language Gloss Strategies Registry
 * Provides language-tailored tokenization, offline dictionaries, and transliteration rules:
 * - Chinese (zh): Multi-character segmentation via Intl.Segmenter, tone-marked Pinyin above word, gloss below.
 * - Arabic (ar): Word tokenization preserving diacritics/tashkeel, phonetic transliteration above word, gloss below.
 * - Polish (pl): Latin word tokenization with Polish diacritics, NO transliteration (clean 2-tier layout), gloss below.
 * - Extensible defaults for Russian (ru), Dutch (nl), English (en), Spanish (es), German (de), French (fr), etc.
 */

export const PUNCTUATION_REGEX = /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()¿?¡!/\-_—\s\t،؛؟ـ]+$/;

// ==========================================
// 1. CHINESE LEXICON (HSK 1-3 & High Frequency)
// ==========================================
export const CHINESE_OFFLINE_DICT = {
  // Greetings & Courtesies
  '欢迎': { pinyin: 'huānyíng', gloss: 'bienvenido' },
  '收听': { pinyin: 'shōutīng', gloss: 'escuchar' },
  '你好': { pinyin: 'nǐ hǎo', gloss: 'hola' },
  '您好': { pinyin: 'nín hǎo', gloss: 'hola (formal)' },
  '早上好': { pinyin: 'zǎoshang hǎo', gloss: 'buenos días' },
  '晚上好': { pinyin: 'wǎnshang hǎo', gloss: 'buenas noches' },
  '谢谢': { pinyin: 'xièxie', gloss: 'gracias' },
  '不客气': { pinyin: 'bù kèqi', gloss: 'de nada' },
  '对不起': { pinyin: 'duìbuqǐ', gloss: 'perdón / disculpas' },
  '没关系': { pinyin: 'méi guānxi', gloss: 'no pasa nada' },
  '再见': { pinyin: 'zàijiàn', gloss: 'adiós / hasta luego' },
  '明天见': { pinyin: 'míngtiān jiàn', gloss: 'hasta mañana' },
  '好久不见': { pinyin: 'hǎojiǔ bùjiàn', gloss: 'cuánto tiempo' },

  // Pronouns
  '我': { pinyin: 'wǒ', gloss: 'yo' },
  '我的': { pinyin: 'wǒ de', gloss: 'mi / mío' },
  '我是': { pinyin: 'wǒ shì', gloss: 'yo soy' },
  '我们': { pinyin: 'wǒmen', gloss: 'nosotros' },
  '你': { pinyin: 'nǐ', gloss: 'tú' },
  '你的': { pinyin: 'nǐ de', gloss: 'tu / tuyo' },
  '你们': { pinyin: 'nǐmen', gloss: 'ustedes / vosotros' },
  '他': { pinyin: 'tā', gloss: 'él' },
  '他的': { pinyin: 'tā de', gloss: 'su (de él)' },
  '他们': { pinyin: 'tāmen', gloss: 'ellos' },
  '她': { pinyin: 'tā', gloss: 'ella' },
  '她的': { pinyin: 'tā de', gloss: 'su (de ella)' },
  '她们': { pinyin: 'tāmen', gloss: 'ellas' },
  '自己': { pinyin: 'zìjǐ', gloss: 'uno mismo' },
  '大家': { pinyin: 'dàjiā', gloss: 'todos' },
  '谁': { pinyin: 'shéi', gloss: 'quién' },
  '别人': { pinyin: 'biéren', gloss: 'los demás' },
  '什么': { pinyin: 'shénme', gloss: 'qué' },
  '怎么': { pinyin: 'zěnme', gloss: 'cómo' },
  '这': { pinyin: 'zhè', gloss: 'este / esta' },
  '这个': { pinyin: 'zhè ge', gloss: 'este' },
  '这里': { pinyin: 'zhèlǐ', gloss: 'aquí' },
  '这封': { pinyin: 'zhè fēng', gloss: 'esta (carta)' },
  '那': { pinyin: 'nà', gloss: 'ese / aquel' },
  '那个': { pinyin: 'nà ge', gloss: 'ese / aquel' },
  '那里': { pinyin: 'nàlǐ', gloss: 'allí' },
  '哪': { pinyin: 'nǎ', gloss: 'cuál / dónde' },
  '哪里': { pinyin: 'nǎlǐ', gloss: 'dónde' },

  // Time & Date
  '今天': { pinyin: 'jīntiān', gloss: 'hoy' },
  '明天': { pinyin: 'míngtiān', gloss: 'mañana' },
  '昨天': { pinyin: 'zuótiān', gloss: 'ayer' },
  '现在': { pinyin: 'xiànzài', gloss: 'ahora' },
  '时间': { pinyin: 'shíjiān', gloss: 'tiempo' },
  '时候': { pinyin: 'shíhou', gloss: 'momento / cuando' },
  '年': { pinyin: 'nián', gloss: 'año' },
  '月': { pinyin: 'yuè', gloss: 'mes' },
  '日': { pinyin: 'rì', gloss: 'día' },
  '号': { pinyin: 'hào', gloss: 'día del mes' },
  '星期': { pinyin: 'xīngqī', gloss: 'semana' },
  '小时': { pinyin: 'xiǎoshí', gloss: 'hora' },
  '分钟': { pinyin: 'fēnzhōng', gloss: 'minuto' },
  '早上': { pinyin: 'zǎoshang', gloss: 'mañana temprano' },
  '中午': { pinyin: 'zhōngwǔ', gloss: 'mediodía' },
  '下午': { pinyin: 'xiàwǔ', gloss: 'tarde' },
  '晚上': { pinyin: 'wǎnshang', gloss: 'noche' },

  // Core Verbs
  '是': { pinyin: 'shì', gloss: 'ser' },
  '有': { pinyin: 'yǒu', gloss: 'tener / haber' },
  '在': { pinyin: 'zài', gloss: 'en / estar' },
  '去': { pinyin: 'qù', gloss: 'ir' },
  '来': { pinyin: 'lái', gloss: 'venir' },
  '看': { pinyin: 'kàn', gloss: 'ver / mirar' },
  '听': { pinyin: 'tīng', gloss: 'escuchar' },
  '说': { pinyin: 'shuō', gloss: 'hablar / decir' },
  '读': { pinyin: 'dú', gloss: 'leer' },
  '写': { pinyin: 'xiě', gloss: 'escribir' },
  '写给': { pinyin: 'xiě gěi', gloss: 'escrita a' },
  '给': { pinyin: 'gěi', gloss: 'dar / para' },
  '想': { pinyin: 'xiǎng', gloss: 'pensar / querer' },
  '我想': { pinyin: 'wǒ xiǎng', gloss: 'pienso / quiero' },
  '要': { pinyin: 'yào', gloss: 'querer / necesitar' },
  '喜欢': { pinyin: 'xǐhuan', gloss: 'gustar' },
  '爱': { pinyin: 'ài', gloss: 'amar / amor' },
  '知道': { pinyin: 'zhīdào', gloss: 'saber' },
  '认识': { pinyin: 'rènshi', gloss: 'conocer' },
  '觉得': { pinyin: 'juéde', gloss: 'opinar / creer' },
  '懂': { pinyin: 'dǒng', gloss: 'entender' },
  '明白': { pinyin: 'míngbai', gloss: 'comprender' },
  '学习': { pinyin: 'xuéxí', gloss: 'aprender / estudiar' },
  '学': { pinyin: 'xué', gloss: 'estudiar' },
  '工作': { pinyin: 'gōngzuò', gloss: 'trabajar / trabajo' },
  '分享': { pinyin: 'fēnxiǎng', gloss: 'compartir' },
  '能够': { pinyin: 'nénggòu', gloss: 'ser capaz' },
  '能': { pinyin: 'néng', gloss: 'poder' },
  '可以': { pinyin: 'kěyǐ', gloss: 'poder / se puede' },
  '会': { pinyin: 'huì', gloss: 'saber / poder' },
  '开始': { pinyin: 'kāishǐ', gloss: 'empezar' },
  '结束': { pinyin: 'jiéshù', gloss: 'terminar' },
  '吃': { pinyin: 'chī', gloss: 'comer' },
  '喝': { pinyin: 'hē', gloss: 'beber' },
  '买': { pinyin: 'mǎi', gloss: 'comprar' },
  '卖': { pinyin: 'mài', gloss: 'vender' },
  '坐': { pinyin: 'zuò', gloss: 'sentarse / viajar en' },
  '走': { pinyin: 'zǒu', gloss: 'caminar / irse' },
  '睡觉': { pinyin: 'shuìjiào', gloss: 'dormir' },
  '找到': { pinyin: 'zhǎodào', gloss: 'encontrar' },
  '希望': { pinyin: 'xīwàng', gloss: 'desear / esperar' },
  '告诉': { pinyin: 'gàosu', gloss: 'decir / contar' },
  '帮助': { pinyin: 'bāngzhù', gloss: 'ayudar' },

  // Common Nouns
  '朋友': { pinyin: 'péngyou', gloss: 'amigo' },
  '老师': { pinyin: 'lǎoshī', gloss: 'profesor' },
  '学生': { pinyin: 'xuésheng', gloss: 'estudiante' },
  '人': { pinyin: 'rén', gloss: 'persona' },
  '男人': { pinyin: 'nánrén', gloss: 'hombre' },
  '女人': { pinyin: 'nǚrén', gloss: 'mujer' },
  '孩子': { pinyin: 'háizi', gloss: 'niño' },
  '中文': { pinyin: 'zhōngwén', gloss: 'idioma chino' },
  '汉语': { pinyin: 'hànyǔ', gloss: 'lengua china' },
  '英语': { pinyin: 'yīngyǔ', gloss: 'idioma inglés' },
  '中国': { pinyin: 'zhōngguó', gloss: 'China' },
  '信': { pinyin: 'xìn', gloss: 'carta' },
  '故事': { pinyin: 'gùshi', gloss: 'historia' },
  '生活': { pinyin: 'shēnghuó', gloss: 'vida' },
  '世界': { pinyin: 'shìjiè', gloss: 'mundo' },
  '地方': { pinyin: 'dìfang', gloss: 'lugar' },
  '家': { pinyin: 'jiā', gloss: 'casa / familia' },
  '学校': { pinyin: 'xuéxiào', gloss: 'escuela' },
  '咖啡': { pinyin: 'kāfēi', gloss: 'café' },
  '茶': { pinyin: 'chá', gloss: 'té' },
  '水': { pinyin: 'shuǐ', gloss: 'agua' },
  '问题': { pinyin: 'wèntí', gloss: 'pregunta / problema' },
  '名字': { pinyin: 'míngzi', gloss: 'nombre' },
  '子轩': { pinyin: 'Zǐxuān', gloss: 'Zixuan (nombre)' },
  '视频': { pinyin: 'shìpín', gloss: 'vídeo' },
  '音乐': { pinyin: 'yīnyuè', gloss: 'música' },

  // Adjectives
  '好': { pinyin: 'hǎo', gloss: 'bien / bueno' },
  '很多': { pinyin: 'hěn duō', gloss: 'muchos / mucho' },
  '多': { pinyin: 'duō', gloss: 'mucho' },
  '少': { pinyin: 'shǎo', gloss: 'poco' },
  '大': { pinyin: 'dà', gloss: 'grande' },
  '小': { pinyin: 'xiǎo', gloss: 'pequeño' },
  '高': { pinyin: 'gāo', gloss: 'alto' },
  '高兴': { pinyin: 'gāoxìng', gloss: 'contento' },
  '开心': { pinyin: 'kāixīn', gloss: 'feliz' },
  '快乐': { pinyin: 'kuàilè', gloss: 'alegre' },
  '漂亮': { pinyin: 'piàoliang', gloss: 'bonito / hermoso' },
  '累': { pinyin: 'lèi', gloss: 'cansado' },
  '困': { pinyin: 'kùn', gloss: 'con sueño' },
  '难': { pinyin: 'nán', gloss: 'difícil' },
  '容易': { pinyin: 'róngyì', gloss: 'fácil' },
  '对': { pinyin: 'duì', gloss: 'correcto / sí' },
  '重要': { pinyin: 'zhòngyào', gloss: 'importante' },

  // Adverbs & Conjunctions
  '很': { pinyin: 'hěn', gloss: 'muy' },
  '太': { pinyin: 'tài', gloss: 'demasiado' },
  '非常': { pinyin: 'fēicháng', gloss: 'sumamente' },
  '真': { pinyin: 'zhēn', gloss: 'realmente' },
  '真的': { pinyin: 'zhēn de', gloss: 'de verdad' },
  '不': { pinyin: 'bù', gloss: 'no' },
  '没': { pinyin: 'méi', gloss: 'no tener / no' },
  '没有': { pinyin: 'méiyǒu', gloss: 'no hay / no tener' },
  '也': { pinyin: 'yě', gloss: 'también' },
  '都': { pinyin: 'dōu', gloss: 'todos / ya' },
  '还': { pinyin: 'hái', gloss: 'todavía / aún' },
  '还有': { pinyin: 'háiyǒu', gloss: 'además / y' },
  '就': { pinyin: 'jiù', gloss: 'entonces / ya' },
  '只': { pinyin: 'zhǐ', gloss: 'solamente' },
  '一起': { pinyin: 'yìqǐ', gloss: 'juntos' },
  '常常': { pinyin: 'chángcháng', gloss: 'a menudo' },
  '因为': { pinyin: 'yīnwèi', gloss: 'porque' },
  '所以': { pinyin: 'suǒyǐ', gloss: 'por eso' },
  '但是': { pinyin: 'dànshì', gloss: 'pero' },
  '如果': { pinyin: 'rúguǒ', gloss: 'si (condicional)' },
  '虽然': { pinyin: 'suīrán', gloss: 'aunque' },
  '然后': { pinyin: 'ránhòu', gloss: 'luego / después' },
  '和': { pinyin: 'hé', gloss: 'y / con' },
  '跟你': { pinyin: 'gēn nǐ', gloss: 'contigo' },
  '跟你说': { pinyin: 'gēn nǐ shuō', gloss: 'decirte a ti' },
  '和你': { pinyin: 'hé nǐ', gloss: 'contigo' },

  // Particles & Numerals
  '的': { pinyin: 'de', gloss: 'de' },
  '地': { pinyin: 'de', gloss: '-mente' },
  '得': { pinyin: 'de', gloss: 'de (grado)' },
  '了': { pinyin: 'le', gloss: 'ya / aspecto' },
  '吗': { pinyin: 'ma', gloss: '¿acaso?' },
  '呢': { pinyin: 'ne', gloss: '¿y...?' },
  '吧': { pinyin: 'ba', gloss: '¿verdad? / vamos' },
  '着': { pinyin: 'zhe', gloss: 'aspecto continuo' },
  '过': { pinyin: 'guo', gloss: 'experiencia previa' },
  '个': { pinyin: 'gè', gloss: 'clasif. general' },
  '封': { pinyin: 'fēng', gloss: 'clasif. cartas' },
  '件': { pinyin: 'jiàn', gloss: 'clasif. asuntos/ropa' },
  '条': { pinyin: 'tiáo', gloss: 'clasif. largo' },
  '点': { pinyin: 'diǎn', gloss: 'un poco / punto' },
  '些': { pinyin: 'xiē', gloss: 'algunos' },
  '一': { pinyin: 'yī', gloss: 'uno' },
  '二': { pinyin: 'èr', gloss: 'dos' },
  '三': { pinyin: 'sān', gloss: 'tres' },
  '四': { pinyin: 'sì', gloss: 'cuatro' },
  '五': { pinyin: 'wǔ', gloss: 'cinco' },
  '六': { pinyin: 'liù', gloss: 'seis' },
  '七': { pinyin: 'qī', gloss: 'siete' },
  '八': { pinyin: 'bā', gloss: 'ocho' },
  '九': { pinyin: 'jiǔ', gloss: 'nueve' },
  '十': { pinyin: 'shí', gloss: 'diez' },
  '两': { pinyin: 'liǎng', gloss: 'dos (cantidad)' }
};

// ==========================================
// 2. ARABIC LEXICON (High Frequency & Vowels)
// ==========================================
export const ARABIC_OFFLINE_DICT = {
  'مرحبا': { translit: 'marḥaban', gloss: 'hola / bienvenido' },
  'مَرْحَبًا': { translit: 'marḥaban', gloss: 'hola / bienvenido' },
  'أهلا': { translit: 'ahlan', gloss: 'hola / bienvenido' },
  'أَهْلًا': { translit: 'ahlan', gloss: 'hola / bienvenido' },
  'أهلا وسهلا': { translit: 'ahlan wa sahlan', gloss: 'bienvenido' },
  'شكرا': { translit: 'shukran', gloss: 'gracias' },
  'شُكْرًا': { translit: 'shukran', gloss: 'gracias' },
  'عفوا': { translit: "'afwan", gloss: 'de nada / perdón' },
  'عَفْوًا': { translit: "'afwan", gloss: 'de nada / perdón' },
  'كيف': { translit: 'kayfa', gloss: 'cómo' },
  'كَيْفَ': { translit: 'kayfa', gloss: 'cómo' },
  'حالك': { translit: 'ḥāluka', gloss: 'tu estado / cómo estás' },
  'حَالُكَ': { translit: 'ḥāluka', gloss: 'tu estado / cómo estás' },
  'أنا': { translit: 'anā', gloss: 'yo' },
  'أَنَا': { translit: 'anā', gloss: 'yo' },
  'أنت': { translit: 'anta', gloss: 'tú' },
  'أَنْتَ': { translit: 'anta', gloss: 'tú (masculino)' },
  'أنتِ': { translit: 'anti', gloss: 'tú (femenino)' },
  'أَنْتِ': { translit: 'anti', gloss: 'tú (femenino)' },
  'هو': { translit: 'huwa', gloss: 'él' },
  'هُوَ': { translit: 'huwa', gloss: 'él' },
  'هي': { translit: 'hiya', gloss: 'ella' },
  'هِيَ': { translit: 'hiya', gloss: 'ella' },
  'نحن': { translit: 'naḥnu', gloss: 'nosotros' },
  'نَحْنُ': { translit: 'naḥnu', gloss: 'nosotros' },
  'هم': { translit: 'hum', gloss: 'ellos' },
  'هُمْ': { translit: 'hum', gloss: 'ellos' },
  'نعم': { translit: "na'am", gloss: 'sí' },
  'نَعَمْ': { translit: "na'am", gloss: 'sí' },
  'لا': { translit: 'lā', gloss: 'no' },
  'لَا': { translit: 'lā', gloss: 'no' },
  'ما': { translit: 'mā', gloss: 'qué' },
  'مَا': { translit: 'mā', gloss: 'qué' },
  'ماذا': { translit: 'mādhā', gloss: 'qué' },
  'مَاذَا': { translit: 'mādhā', gloss: 'qué' },
  'من': { translit: 'min / man', gloss: 'de / quién' },
  'مَنْ': { translit: 'man', gloss: 'quién' },
  'مِنْ': { translit: 'min', gloss: 'de / desde' },
  'أين': { translit: 'ayna', gloss: 'dónde' },
  'أَيْنَ': { translit: 'ayna', gloss: 'dónde' },
  'متى': { translit: 'matā', gloss: 'cuándo' },
  'مَتَى': { translit: 'matā', gloss: 'cuándo' },
  'لماذا': { translit: 'limādhā', gloss: 'por qué' },
  'لِمَاذَا': { translit: 'limādhā', gloss: 'por qué' },
  'في': { translit: 'fī', gloss: 'en' },
  'فِي': { translit: 'fī', gloss: 'en' },
  'إلى': { translit: 'ilā', gloss: 'a / hacia' },
  'إِلَى': { translit: 'ilā', gloss: 'a / hacia' },
  'على': { translit: "'alā", gloss: 'sobre / en' },
  'عَلَى': { translit: "'alā", gloss: 'sobre / en' },
  'مع': { translit: "ma'a", gloss: 'con' },
  'مَعَ': { translit: "ma'a", gloss: 'con' },
  'هذا': { translit: 'hādhā', gloss: 'este' },
  'هَذَا': { translit: 'hādhā', gloss: 'este' },
  'هذه': { translit: 'hādhihi', gloss: 'esta' },
  'هَذِهِ': { translit: 'hādhihi', gloss: 'esta' },
  'اليوم': { translit: 'al-yawm', gloss: 'hoy' },
  'اليَوْمَ': { translit: 'al-yawm', gloss: 'hoy' },
  'صباح': { translit: 'ṣabāḥ', gloss: 'mañana' },
  'صَبَاح': { translit: 'ṣabāḥ', gloss: 'mañana' },
  'صباح الخير': { translit: 'ṣabāḥ al-khayr', gloss: 'buenos días' },
  'مساء': { translit: "masā'", gloss: 'tarde / noche' },
  'مَسَاء': { translit: "masā'", gloss: 'tarde / noche' },
  'مساء الخير': { translit: "masā' al-khayr", gloss: 'buenas tardes/noches' },
  'ماء': { translit: "mā'", gloss: 'agua' },
  'مَاء': { translit: "mā'", gloss: 'agua' },
  'قهوة': { translit: 'qahwah', gloss: 'café' },
  'قَهْوَة': { translit: 'qahwah', gloss: 'café' },
  'شاي': { translit: 'shāy', gloss: 'té' },
  'شَاي': { translit: 'shāy', gloss: 'té' },
  'كتاب': { translit: 'kitāb', gloss: 'libro' },
  'كِتَاب': { translit: 'kitāb', gloss: 'libro' },
  'بيت': { translit: 'bayt', gloss: 'casa' },
  'بَيْت': { translit: 'bayt', gloss: 'casa' },
  'جميل': { translit: 'jamīl', gloss: 'bonito / hermoso' },
  'جَمِيل': { translit: 'jamīl', gloss: 'bonito / hermoso' },
  'جيد': { translit: 'jayyid', gloss: 'bien / bueno' },
  'جَيِّد': { translit: 'jayyid', gloss: 'bien / bueno' },
  'كبير': { translit: 'kabīr', gloss: 'grande' },
  'كَبِير': { translit: 'kabīr', gloss: 'grande' },
  'صغير': { translit: 'ṣaghīr', gloss: 'pequeño' },
  'صَغِير': { translit: 'ṣaghīr', gloss: 'pequeño' },
  'أريد': { translit: 'urīdu', gloss: 'quiero' },
  'أُرِيدُ': { translit: 'urīdu', gloss: 'quiero' },
  'أعرف': { translit: "a'rifu", gloss: 'sé / conozco' },
  'أَعْرِفُ': { translit: "a'rifu", gloss: 'sé / conozco' }
};

// ==========================================
// 3. POLISH LEXICON (Latin Script, NO Translit)
// ==========================================
export const POLISH_OFFLINE_DICT = {
  // Greetings & Courtesies
  'cześć': { gloss: 'hola / adiós' },
  'dzień': { gloss: 'día' },
  'dobry': { gloss: 'bueno' },
  'wieczór': { gloss: 'tarde / noche' },
  'do': { gloss: 'a / hacia' },
  'widzenia': { gloss: 'la vista (despedida)' },
  'dziękuję': { gloss: 'gracias' },
  'dzięki': { gloss: 'gracias (informal)' },
  'bardzo': { gloss: 'mucho / muy' },
  'proszę': { gloss: 'por favor / de nada' },
  'przepraszam': { gloss: 'perdón / disculpe' },

  // Question Words & Conjunctions
  'jak': { gloss: 'cómo' },
  'co': { gloss: 'qué' },
  'kto': { gloss: 'quién' },
  'gdzie': { gloss: 'dónde' },
  'kiedy': { gloss: 'cuándo' },
  'dlaczego': { gloss: 'por qué' },
  'ile': { gloss: 'cuánto' },
  'tak': { gloss: 'sí' },
  'nie': { gloss: 'no' },
  'i': { gloss: 'y' },
  'a': { gloss: 'y / mientras' },
  'ale': { gloss: 'pero' },
  'lub': { gloss: 'o' },
  'albo': { gloss: 'o' },
  'bo': { gloss: 'porque' },
  'ponieważ': { gloss: 'ya que / porque' },
  'że': { gloss: 'que (conjunción)' },

  // Pronouns & Demonstratives
  'ja': { gloss: 'yo' },
  'ty': { gloss: 'tú' },
  'on': { gloss: 'él' },
  'ona': { gloss: 'ella' },
  'ono': { gloss: 'ello' },
  'my': { gloss: 'nosotros' },
  'wy': { gloss: 'ustedes / vosotros' },
  'oni': { gloss: 'ellos' },
  'one': { gloss: 'ellas' },
  'się': { gloss: 'se / -se' },
  'mi': { gloss: 'a mí / me' },
  'mnie': { gloss: 'mí / me' },
  'cię': { gloss: 'te' },
  'go': { gloss: 'lo / le' },
  'ją': { gloss: 'la' },
  'to': { gloss: 'esto / es' },
  'ten': { gloss: 'este' },
  'ta': { gloss: 'esta' },
  'tam': { gloss: 'allí' },
  'tu': { gloss: 'aquí' },
  'tutaj': { gloss: 'aquí' },

  // Common Verbs (Conjugated & Infinitives)
  'jestem': { gloss: 'soy / estoy' },
  'jesteś': { gloss: 'eres / estás' },
  'jest': { gloss: 'es / está' },
  'jesteśmy': { gloss: 'somos / estamos' },
  'jesteście': { gloss: 'sois / están' },
  'są': { gloss: 'son / están' },
  'być': { gloss: 'ser / estar' },
  'mam': { gloss: 'tengo' },
  'masz': { gloss: 'tienes / te va' },
  'ma': { gloss: 'tiene' },
  'mamy': { gloss: 'tenemos' },
  'macie': { gloss: 'tenéis / tienen' },
  'mają': { gloss: 'tienen' },
  'mieć': { gloss: 'tener' },
  'chcę': { gloss: 'quiero' },
  'chcesz': { gloss: 'quieres' },
  'chce': { gloss: 'quiere' },
  'chcemy': { gloss: 'queremos' },
  'chcieć': { gloss: 'querer' },
  'lubię': { gloss: 'me gusta' },
  'lubisz': { gloss: 'te gusta' },
  'lubi': { gloss: 'le gusta' },
  'wiem': { gloss: 'sé' },
  'wiesz': { gloss: 'sabes' },
  'wie': { gloss: 'sabe' },
  'rozumiem': { gloss: 'entiendo' },
  'rozumiesz': { gloss: 'entiendes' },
  'spać': { gloss: 'dormir' },
  'widzę': { gloss: 'veo' },
  'mówię': { gloss: 'hablo' },
  'mówisz': { gloss: 'hablas' },

  // Nouns, Adjectives & Prepositions
  'kawa': { gloss: 'café' },
  'kawę': { gloss: 'café (acusativo)' },
  'herbata': { gloss: 'té' },
  'herbatę': { gloss: 'té (acusativo)' },
  'woda': { gloss: 'agua' },
  'wodę': { gloss: 'agua (acusativo)' },
  'dom': { gloss: 'casa' },
  'praca': { gloss: 'trabajo' },
  'czas': { gloss: 'tiempo' },
  'życie': { gloss: 'vida' },
  'człowiek': { gloss: 'persona' },
  'ludzie': { gloss: 'gente / personas' },
  'dzisiaj': { gloss: 'hoy' },
  'jutro': { gloss: 'mañana' },
  'wczoraj': { gloss: 'ayer' },
  'teraz': { gloss: 'ahora' },
  'dobrze': { gloss: 'bien' },
  'źle': { gloss: 'mal' },
  'fajnie': { gloss: 'genial / chévere' },
  'senny': { gloss: 'somnoliento' },
  'zmęczony': { gloss: 'cansado' },
  'w': { gloss: 'en' },
  'we': { gloss: 'en' },
  'na': { gloss: 'en / sobre' },
  'z': { gloss: 'con / de' },
  'ze': { gloss: 'con' },
  'o': { gloss: 'sobre / acerca de' }
};

// ==========================================
// 4. STRATEGY REGISTRY & IMPLEMENTATION
// ==========================================

export class ChineseGlossStrategy {
  constructor() {
    this.code = 'zh';
    this.name = 'Chino';
    this.hasTranslit = true;
    this.requiresTranslit = true;
    this.translitKey = 'pinyin';
    this.offlineDict = CHINESE_OFFLINE_DICT;
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    const tokens = [];
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
        const segments = [...segmenter.segment(cleanStr)];
        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;
          const isPunctuation = PUNCTUATION_REGEX.test(w);
          const entry = isPunctuation ? null : this.lookupOffline(w);
          tokens.push({
            text: w,
            word: w,
            pinyin: isPunctuation ? null : (entry?.pinyin || null),
            gloss: isPunctuation ? null : (entry?.gloss || null),
            isPunctuation
          });
        }
        if (tokens.length > 0) return tokens;
      }
    } catch (e) {
      console.warn('Intl.Segmenter fallback in ChineseGlossStrategy:', e);
    }

    // Fallback regex if Intl.Segmenter fails
    const words = cleanStr.match(/[\u4E00-\u9FFF]{1,4}|[a-zA-Z0-9]+|[^\s]/g) || [cleanStr];
    for (const w of words) {
      if (!w.trim()) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      const entry = isPunctuation ? null : this.lookupOffline(w);
      tokens.push({
        text: w,
        word: w,
        pinyin: isPunctuation ? null : (entry?.pinyin || null),
        gloss: isPunctuation ? null : (entry?.gloss || null),
        isPunctuation
      });
    }
    return tokens;
  }

  lookupOffline(word) {
    if (!word) return null;
    const clean = word.trim();
    return this.offlineDict[clean] || null;
  }

  isTokenComplete(token) {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss || (gloss === w && w !== '的')) return false;

    // Chinese characters must have tone-marked Pinyin
    if (/[\u4E00-\u9FFF]/.test(w)) {
      const pinyin = typeof token.pinyin === 'string' ? token.pinyin.trim() : '';
      if (!pinyin || pinyin === gloss) return false;
    }
    return true;
  }
}

export class ArabicGlossStrategy {
  constructor() {
    this.code = 'ar';
    this.name = 'Árabe';
    this.hasTranslit = true;
    this.requiresTranslit = false; // Transliteration is supported/prioritized, but doesn't block completion if gloss exists
    this.translitKey = 'translit';
    this.offlineDict = ARABIC_OFFLINE_DICT;
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    const tokens = [];
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('ar', { granularity: 'word' });
        const segments = [...segmenter.segment(cleanStr)];
        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;
          const isPunctuation = !seg.isWordLike || PUNCTUATION_REGEX.test(w);
          const entry = isPunctuation ? null : this.lookupOffline(w);

          tokens.push({
            text: w,
            word: w,
            pinyin: null,
            translit: isPunctuation ? null : (entry?.translit || null),
            gloss: isPunctuation ? null : (entry?.gloss || null),
            isPunctuation
          });
        }
        if (tokens.length > 0) return tokens;
      }
    } catch (e) {
      console.warn('Intl.Segmenter fallback in ArabicGlossStrategy:', e);
    }

    // Fallback regex separating punctuation including Arabic comma, semicolon, question mark
    const parts = cleanStr.split(/([\u0621-\u064A\u0660-\u0669\u064B-\u065F\u0670\u0671-\u06D3]+|[^\s\u0621-\u064A\u0660-\u0669\u064B-\u065F\u0670\u0671-\u06D3]+)/).filter(Boolean);

    for (const part of parts) {
      const w = part.trim();
      if (!w) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      const entry = isPunctuation ? null : this.lookupOffline(w);

      tokens.push({
        text: w,
        word: w,
        pinyin: null,
        translit: isPunctuation ? null : (entry?.translit || null),
        gloss: isPunctuation ? null : (entry?.gloss || null),
        isPunctuation
      });
    }
    return tokens;
  }

  lookupOffline(word) {
    if (!word) return null;
    const clean = word.trim();
    // Try exact (with vowels if present)
    if (this.offlineDict[clean]) return this.offlineDict[clean];
    // Try normalized without tashkeel (fatḥah, kasrah, ḍammah, sukūn, shaddah, etc.)
    const stripped = clean.replace(/[\u064B-\u065F\u0670]/g, '');
    if (this.offlineDict[stripped]) return this.offlineDict[stripped];
    return null;
  }

  isTokenComplete(token) {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss || gloss === w) return false;
    return true;
  }
}

export class PolishGlossStrategy {
  constructor() {
    this.code = 'pl';
    this.name = 'Polaco';
    this.hasTranslit = false; // STRICTLY NO TRANSLITERATION FOR POLISH!
    this.requiresTranslit = false;
    this.translitKey = null;
    this.offlineDict = POLISH_OFFLINE_DICT;
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    // Polish words with diacritics (ą, ę, ś, ć, ż, ź, ł, ó, ń)
    const parts = cleanStr.split(/([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^\sa-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/).filter(Boolean);
    const tokens = [];

    for (const part of parts) {
      const w = part.trim();
      if (!w) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      const entry = isPunctuation ? null : this.lookupOffline(w);

      tokens.push({
        text: w,
        word: w,
        pinyin: null,
        translit: null,
        gloss: isPunctuation ? null : (entry?.gloss || null),
        isPunctuation
      });
    }
    return tokens;
  }

  lookupOffline(word) {
    if (!word) return null;
    const clean = word.trim().toLowerCase();
    return this.offlineDict[clean] || null;
  }

  isTokenComplete(token) {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss || gloss.toLowerCase() === w.toLowerCase()) return false;
    return true;
  }
}

export class DefaultGlossStrategy {
  constructor(langCode = 'default') {
    this.code = langCode;
    this.name = langCode.toUpperCase();
    this.hasTranslit = ['ru'].includes(langCode);
    this.requiresTranslit = false;
    this.translitKey = this.hasTranslit ? 'translit' : null;
    this.offlineDict = {};
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    const parts = cleanStr.split(/(\s+|[.,!?;:'"()\-]+)/).filter(p => p && p.trim().length > 0);
    return parts.map(w => {
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      return {
        text: w,
        word: w,
        pinyin: null,
        translit: null,
        gloss: null,
        isPunctuation
      };
    });
  }

  lookupOffline() {
    return null;
  }

  isTokenComplete(token) {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;
    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    return Boolean(gloss && gloss !== w);
  }
}

// Strategy Singleton Instances
const strategyInstances = {
  zh: new ChineseGlossStrategy(),
  ar: new ArabicGlossStrategy(),
  pl: new PolishGlossStrategy()
};

/**
 * Get language gloss strategy for any target language
 */
export function getLanguageGlossStrategy(targetLang = 'zh') {
  const code = (targetLang || 'zh').toLowerCase().split('-')[0];
  if (strategyInstances[code]) {
    return strategyInstances[code];
  }
  return new DefaultGlossStrategy(code);
}
