/**
 * Language Gloss Strategies Registry
 * Provides language-tailored tokenization, offline dictionaries, and transliteration rules:
 * - Chinese (zh): Multi-character segmentation via Intl.Segmenter, tone-marked Pinyin above word, gloss below.
 * - Arabic (ar): RTL script, preserves tashkeel, strictly NO transliteration, Spanish gloss below.
 * - Polish (pl): Latin word tokenization with Polish diacritics, NO transliteration (clean 2-tier layout), gloss below.
 * - Extensible defaults for Russian (ru, Cyrillic without transliteration), Dutch (nl), English (en), Spanish (es), German (de), French (fr), etc.
 */

export const PUNCTUATION_REGEX = /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()¿?¡!/\-_—\s\t،؛؟ـ]+$/;

import { validateChineseAiSegmentation } from './subtitleGlossService.js';
import { getArabicTransliteration } from './arabicTransliteration.js';
import { ARABIC_OFFLINE_DICT } from './arabicOfflineDict.js';
export { ARABIC_OFFLINE_DICT };

export function reconcileChineseTokens(originalText, aiTokens) {
  if (!originalText || typeof originalText !== 'string' || !Array.isArray(aiTokens) || aiTokens.length === 0) {
    return null;
  }
  const isValid = validateChineseAiSegmentation(originalText, aiTokens);
  if (isValid) {
    return aiTokens;
  }
  console.warn('[reconcileChineseTokens] Token coverage validation failed for Chinese text');
  return null;
}
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
  '两': { pinyin: 'liǎng', gloss: 'dos (cantidad)' },

  // ==========================================
  // HSK 1-2 vocabulary expansion (aditivo)
  // ==========================================

  // Family & people
  '爸爸': { pinyin: 'bàba', gloss: 'papá' },
  '妈妈': { pinyin: 'māma', gloss: 'mamá' },
  '哥哥': { pinyin: 'gēge', gloss: 'hermano mayor' },
  '姐姐': { pinyin: 'jiějie', gloss: 'hermana mayor' },
  '弟弟': { pinyin: 'dìdi', gloss: 'hermano menor' },
  '妹妹': { pinyin: 'mèimei', gloss: 'hermana menor' },
  '家人': { pinyin: 'jiārén', gloss: 'familia' },
  '医生': { pinyin: 'yīshēng', gloss: 'médico' },
  '医院': { pinyin: 'yīyuàn', gloss: 'hospital' },
  '公司': { pinyin: 'gōngsī', gloss: 'empresa' },

  // Time
  '每天': { pinyin: 'měitiān', gloss: 'cada día' },
  '晚安': { pinyin: 'wǎn ān', gloss: 'buenas noches (al dormir)' },
  '秒': { pinyin: 'miǎo', gloss: 'segundo (tiempo)' },
  '以前': { pinyin: 'yǐqián', gloss: 'antes' },
  '以后': { pinyin: 'yǐhòu', gloss: 'después' },
  '以为': { pinyin: 'yǐwéi', gloss: 'creer (erróneamente)' },
  '已经': { pinyin: 'yǐjīng', gloss: 'ya' },
  '正在': { pinyin: 'zhèngzài', gloss: 'estar (haciendo)' },
  '刚才': { pinyin: 'gāngcái', gloss: 'hace un momento' },
  '将来': { pinyin: 'jiānglái', gloss: 'futuro' },
  '未来': { pinyin: 'wèilái', gloss: 'futuro' },
  '马上': { pinyin: 'mǎshàng', gloss: 'inmediatamente' },
  '立刻': { pinyin: 'lìkè', gloss: 'inmediatamente' },
  '慢慢': { pinyin: 'mànman', gloss: 'despacio' },
  '快点': { pinyin: 'kuài diǎn', gloss: 'rápido' },
  '春天': { pinyin: 'chūntiān', gloss: 'primavera' },
  '夏天': { pinyin: 'xiàtiān', gloss: 'verano' },
  '秋天': { pinyin: 'qiūtiān', gloss: 'otoño' },
  '冬天': { pinyin: 'dōngtiān', gloss: 'invierno' },
  '季节': { pinyin: 'jìjié', gloss: 'estación' },
  '天气': { pinyin: 'tiānqì', gloss: 'clima' },

  // Common function words / adverbs / quantifiers
  '东西': { pinyin: 'dōngxi', gloss: 'cosa' },
  '怎样': { pinyin: 'zěnyàng', gloss: 'cómo' },
  '哪儿': { pinyin: 'nǎr', gloss: 'dónde' },
  '一下': { pinyin: 'yíxià', gloss: 'un momento' },
  '一点': { pinyin: 'yìdiǎn', gloss: 'un poco' },
  '有点': { pinyin: 'yǒudiǎn', gloss: 'algo / un poco' },
  '一定': { pinyin: 'yídìng', gloss: 'ciertamente' },
  '一直': { pinyin: 'yìzhí', gloss: 'todo el tiempo' },
  '太多': { pinyin: 'tài duō', gloss: 'demasiado' },
  '特别': { pinyin: 'tèbié', gloss: 'especial' },
  '再': { pinyin: 'zài', gloss: 'otra vez' },
  '又': { pinyin: 'yòu', gloss: 'otra vez / además' },
  '才': { pinyin: 'cái', gloss: 'sólo / recién' },
  '其他': { pinyin: 'qítā', gloss: 'otros' },
  '别的': { pinyin: 'biéde', gloss: 'otro' },
  '所有': { pinyin: 'suǒyǒu', gloss: 'todos' },
  '一切': { pinyin: 'yíqiè', gloss: 'todo' },
  '什么样': { pinyin: 'shénme yàng', gloss: 'qué tipo' },
  '为什么': { pinyin: 'wèi shénme', gloss: 'por qué' },
  '可是': { pinyin: 'kěshì', gloss: 'pero' },
  '而且': { pinyin: 'érqiě', gloss: 'y además' },
  '或者': { pinyin: 'huòzhě', gloss: 'o' },
  '不但': { pinyin: 'búdàn', gloss: 'no sólo' },
  '不仅': { pinyin: 'bùjǐn', gloss: 'no sólo' },
  '就是': { pinyin: 'jiùshì', gloss: 'exactamente' },
  '那么': { pinyin: 'nàme', gloss: 'entonces' },
  '这么': { pinyin: 'zhème', gloss: 'así' },
  '那样': { pinyin: 'nàyàng', gloss: 'de esa manera' },
  '这样': { pinyin: 'zhèyàng', gloss: 'así' },

  // Verbs
  '认为': { pinyin: 'rènwéi', gloss: 'considerar' },
  '需要': { pinyin: 'xūyào', gloss: 'necesitar' },
  '准备': { pinyin: 'zhǔnbèi', gloss: 'preparar' },
  '完成': { pinyin: 'wánchéng', gloss: 'completar' },
  '继续': { pinyin: 'jìxù', gloss: 'continuar' },
  '出去': { pinyin: 'chūqu', gloss: 'salir' },
  '回家': { pinyin: 'huíjiā', gloss: 'volver a casa' },
  '回来': { pinyin: 'huílai', gloss: 'volver' },
  '进去': { pinyin: 'jìnqu', gloss: 'entrar' },
  '进来': { pinyin: 'jìnlai', gloss: 'entrar (hacia el hablante)' },
  '出来': { pinyin: 'chūlai', gloss: 'salir (hacia el hablante)' },
  '上班': { pinyin: 'shàngbān', gloss: 'ir al trabajo' },
  '下班': { pinyin: 'xiàbān', gloss: 'salir del trabajo' },
  '上学': { pinyin: 'shàngxué', gloss: 'ir a la escuela' },
  '放学': { pinyin: 'fàngxué', gloss: 'salir de la escuela' },
  '吃饭': { pinyin: 'chīfàn', gloss: 'comer' },
  '早饭': { pinyin: 'zǎofàn', gloss: 'desayuno' },
  '午饭': { pinyin: 'wǔfàn', gloss: 'almuerzo' },
  '晚饭': { pinyin: 'wǎnfàn', gloss: 'cena' },
  '做饭': { pinyin: 'zuòfàn', gloss: 'cocinar' },
  '开车': { pinyin: 'kāichē', gloss: 'conducir' },
  '走路': { pinyin: 'zǒulù', gloss: 'caminar' },
  '坐车': { pinyin: 'zuò chē', gloss: 'ir en coche' },
  '买东西': { pinyin: 'mǎi dōngxi', gloss: 'comprar cosas' },

  // Places
  '商店': { pinyin: 'shāngdiàn', gloss: 'tienda' },
  '超市': { pinyin: 'chāoshì', gloss: 'supermercado' },
  '市场': { pinyin: 'shìchǎng', gloss: 'mercado' },
  '银行': { pinyin: 'yínháng', gloss: 'banco' },
  '邮局': { pinyin: 'yóujú', gloss: 'oficina de correos' },
  '图书馆': { pinyin: 'túshūguǎn', gloss: 'biblioteca' },
  '厕所': { pinyin: 'cèsuǒ', gloss: 'baño' },
  '洗手间': { pinyin: 'xǐshǒujiān', gloss: 'baño' },
  '房间': { pinyin: 'fángjiān', gloss: 'habitación' },
  '厨房': { pinyin: 'chúfáng', gloss: 'cocina' },
  '客厅': { pinyin: 'kètīng', gloss: 'sala' },
  '卧室': { pinyin: 'wòshì', gloss: 'dormitorio' },
  '书店': { pinyin: 'shūdiàn', gloss: 'librería' },
  '饭店': { pinyin: 'fàndiàn', gloss: 'restaurante' },
  '宾馆': { pinyin: 'bīnguǎn', gloss: 'hotel' },
  '酒店': { pinyin: 'jiǔdiàn', gloss: 'hotel' },

  // Transport
  '火车': { pinyin: 'huǒchē', gloss: 'tren' },
  '飞机': { pinyin: 'fēijī', gloss: 'avión' },
  '汽车': { pinyin: 'qìchē', gloss: 'coche' },
  '出租车': { pinyin: 'chūzūchē', gloss: 'taxi' },
  '地铁': { pinyin: 'dìtiě', gloss: 'metro' },
  '公共汽车': { pinyin: 'gōnggòng qìchē', gloss: 'autobús' },
  '自行车': { pinyin: 'zìxíngchē', gloss: 'bicicleta' },

  // Objects
  '电脑': { pinyin: 'diànnǎo', gloss: 'computadora' },
  '电视': { pinyin: 'diànshì', gloss: 'televisión' },
  '电话': { pinyin: 'diànhuà', gloss: 'teléfono' },
  '手机': { pinyin: 'shǒujī', gloss: 'móvil' },
  '衣服': { pinyin: 'yīfu', gloss: 'ropa' },
  '裤子': { pinyin: 'kùzi', gloss: 'pantalones' },
  '帽子': { pinyin: 'màozi', gloss: 'sombrero' },
  '鞋子': { pinyin: 'xiézi', gloss: 'zapatos' },
  '包': { pinyin: 'bāo', gloss: 'bolso' },
  '钱包': { pinyin: 'qiánbāo', gloss: 'billetera' },
  '钥匙': { pinyin: 'yàoshi', gloss: 'llave' },
  '眼镜': { pinyin: 'yǎnjìng', gloss: 'gafas' },
  '手表': { pinyin: 'shǒubiǎo', gloss: 'reloj' },
  '桌子': { pinyin: 'zhuōzi', gloss: 'mesa' },
  '椅子': { pinyin: 'yǐzi', gloss: 'silla' },
  '床': { pinyin: 'chuáng', gloss: 'cama' },
  '门': { pinyin: 'mén', gloss: 'puerta' },
  '窗户': { pinyin: 'chuānghu', gloss: 'ventana' },
  '灯': { pinyin: 'dēng', gloss: 'lámpara' },
  '空调': { pinyin: 'kōngtiáo', gloss: 'aire acondicionado' },
  '冰箱': { pinyin: 'bīngxiāng', gloss: 'refrigerador' },
  '洗衣机': { pinyin: 'xǐyījī', gloss: 'lavadora' },
  '电梯': { pinyin: 'diàntī', gloss: 'ascensor' },

  // Emotions & states
  '年轻': { pinyin: 'niánqīng', gloss: 'joven' },
  '老': { pinyin: 'lǎo', gloss: 'viejo' },
  '好看': { pinyin: 'hǎokàn', gloss: 'lindo' },
  '难看': { pinyin: 'nánkàn', gloss: 'feo' },
  '幸福': { pinyin: 'xìngfú', gloss: 'feliz' },
  '难过': { pinyin: 'nánguò', gloss: 'triste' },
  '生气': { pinyin: 'shēngqì', gloss: 'enojado' },
  '害怕': { pinyin: 'hàipà', gloss: 'temer' },
  '担心': { pinyin: 'dānxīn', gloss: 'preocuparse' },
  '紧张': { pinyin: 'jǐnzhāng', gloss: 'nervioso' },
  '忙': { pinyin: 'máng', gloss: 'ocupado' },
  '闲': { pinyin: 'xián', gloss: 'ocioso' },
  '饿': { pinyin: 'è', gloss: 'hambriento' },
  '渴': { pinyin: 'kě', gloss: 'sediento' },
  '冷': { pinyin: 'lěng', gloss: 'frío' },
  '热': { pinyin: 'rè', gloss: 'caliente' },
  '暖和': { pinyin: 'nuǎnhuo', gloss: 'cálido' },
  '凉快': { pinyin: 'liángkuai', gloss: 'fresco' },
  '舒服': { pinyin: 'shūfu', gloss: 'cómodo' },
  '有意思': { pinyin: 'yǒu yìsi', gloss: 'interesante' },
  '无聊': { pinyin: 'wúliáo', gloss: 'aburrido' },
  '聪明': { pinyin: 'cōngming', gloss: 'inteligente' },
  '笨': { pinyin: 'bèn', gloss: 'tonto' },
  '勤奋': { pinyin: 'qínfèn', gloss: 'diligente' },
  '懒': { pinyin: 'lǎn', gloss: 'perezoso' },
  '努力': { pinyin: 'nǔlì', gloss: 'esforzarse' },
  '认真': { pinyin: 'rènzhēn', gloss: 'con atención' },
  '马虎': { pinyin: 'mǎhu', gloss: 'descuidado' },
  '小心': { pinyin: 'xiǎoxīn', gloss: 'cuidado' },
  '放心': { pinyin: 'fàngxīn', gloss: 'tranquilo' },
  '安心': { pinyin: 'ānxīn', gloss: 'tranquilo' },
  '关心': { pinyin: 'guānxīn', gloss: 'preocuparse por' },

  // Directions
  '东': { pinyin: 'dōng', gloss: 'este' },
  '西': { pinyin: 'xī', gloss: 'oeste' },
  '南': { pinyin: 'nán', gloss: 'sur' },
  '北': { pinyin: 'běi', gloss: 'norte' },
  '左': { pinyin: 'zuǒ', gloss: 'izquierda' },
  '右': { pinyin: 'yòu', gloss: 'derecha' },
  '前': { pinyin: 'qián', gloss: 'delante' },
  '后': { pinyin: 'hòu', gloss: 'detrás' },
  '里': { pinyin: 'lǐ', gloss: 'dentro' },
  '外': { pinyin: 'wài', gloss: 'fuera' },
  '上面': { pinyin: 'shàngmiàn', gloss: 'arriba' },
  '下面': { pinyin: 'xiàmiàn', gloss: 'abajo' },
  '中间': { pinyin: 'zhōngjiān', gloss: 'en medio' },
  '旁边': { pinyin: 'pángbiān', gloss: 'al lado' },
  '附近': { pinyin: 'fùjìn', gloss: 'cerca' },
  '远': { pinyin: 'yuǎn', gloss: 'lejos' },
  '近': { pinyin: 'jìn', gloss: 'cerca' },
  '里面': { pinyin: 'lǐmiàn', gloss: 'dentro' },
  '外面': { pinyin: 'wàimiàn', gloss: 'fuera' },
  '上边': { pinyin: 'shàngbian', gloss: 'arriba' },
  '下边': { pinyin: 'xiàbian', gloss: 'abajo' },
  '里边': { pinyin: 'lǐbian', gloss: 'dentro' },
  '外边': { pinyin: 'wàibian', gloss: 'fuera' },

  // Comparatives
  '低': { pinyin: 'dī', gloss: 'bajo' },
  '长': { pinyin: 'cháng', gloss: 'largo' },
  '短': { pinyin: 'duǎn', gloss: 'corto' },
  '轻': { pinyin: 'qīng', gloss: 'liviano' },
  '重': { pinyin: 'zhòng', gloss: 'pesado' },
  '厚': { pinyin: 'hòu', gloss: 'grueso' },
  '薄': { pinyin: 'báo', gloss: 'fino' },
  '宽': { pinyin: 'kuān', gloss: 'ancho' },
  '窄': { pinyin: 'zhǎi', gloss: 'estrecho' },
  '深': { pinyin: 'shēn', gloss: 'profundo' },
  '浅': { pinyin: 'qiǎn', gloss: 'superficial' },
  '新': { pinyin: 'xīn', gloss: 'nuevo' },
  '旧': { pinyin: 'jiù', gloss: 'viejo (objeto)' },
  '贵': { pinyin: 'guì', gloss: 'caro' },
  '便宜': { pinyin: 'piányi', gloss: 'barato' },
  '早': { pinyin: 'zǎo', gloss: 'temprano' },
  '晚': { pinyin: 'wǎn', gloss: 'tarde' },
  '快': { pinyin: 'kuài', gloss: 'rápido' },
  '慢': { pinyin: 'màn', gloss: 'lento' },
  '错': { pinyin: 'cuò', gloss: 'equivocado' },
  '假': { pinyin: 'jiǎ', gloss: 'falso' },

  // Frequent nouns
  '方法': { pinyin: 'fāngfǎ', gloss: 'método' },
  '意思': { pinyin: 'yìsi', gloss: 'significado' },
  '名字': { pinyin: 'míngzi', gloss: 'nombre' },
  '问题': { pinyin: 'wèntí', gloss: 'problema' },
  '事情': { pinyin: 'shìqing', gloss: 'asunto' },
  '办法': { pinyin: 'bànfǎ', gloss: 'manera' },
  '地方': { pinyin: 'dìfang', gloss: 'lugar' },
  '书': { pinyin: 'shū', gloss: 'libro' },
  '字': { pinyin: 'zì', gloss: 'carácter' },
  '词': { pinyin: 'cí', gloss: 'palabra' },
  '句子': { pinyin: 'jùzi', gloss: 'frase' },
  '句': { pinyin: 'jù', gloss: 'frase (m.p.)' },
  '段': { pinyin: 'duàn', gloss: 'párrafo / segmento' },
  '文本': { pinyin: 'wénběn', gloss: 'texto' },
  '文章': { pinyin: 'wénzhāng', gloss: 'artículo' },
  '故事': { pinyin: 'gùshi', gloss: 'historia' },
  '内容': { pinyin: 'nèiróng', gloss: 'contenido' },
  '例子': { pinyin: 'lìzi', gloss: 'ejemplo' },
  '知识': { pinyin: 'zhīshi', gloss: 'conocimiento' },
  '经验': { pinyin: 'jīngyàn', gloss: 'experiencia' },

  // HSK 1-2 frequent single chars (data only) + more compounds
  // Common compounds that appear in conversational responses
  '汉字': { pinyin: 'hànzì', gloss: 'carácter chino' },
  '发音': { pinyin: 'fāyīn', gloss: 'pronunciación' },
  '聊天': { pinyin: 'liáotiān', gloss: 'charlar' },
  '部分': { pinyin: 'bùfen', gloss: 'parte' },
  '一部分': { pinyin: 'yí bùfen', gloss: 'una parte' },
  '坚持': { pinyin: 'jiānchí', gloss: 'persistir' },
  '加油': { pinyin: 'jiāyóu', gloss: '¡ánimo!' },
  '最好': { pinyin: 'zuì hǎo', gloss: 'lo mejor' },
  '最近': { pinyin: 'zuìjìn', gloss: 'recientemente' },
  '最后': { pinyin: 'zuìhòu', gloss: 'al final' },
  '觉得': { pinyin: 'juéde', gloss: 'creer / sentir' },
  '感觉': { pinyin: 'gǎnjué', gloss: 'sensación' },
  '一件': { pinyin: 'yí jiàn', gloss: 'una unidad' },
  '一件事': { pinyin: 'yí jiàn shì', gloss: 'un asunto' },
  '音乐': { pinyin: 'yīnyuè', gloss: 'música' },
  '快乐': { pinyin: 'kuàilè', gloss: 'feliz' },
  '朋友': { pinyin: 'péngyou', gloss: 'amigo' },
  '老师': { pinyin: 'lǎoshī', gloss: 'profesor' },
  '学校': { pinyin: 'xuéxiào', gloss: 'escuela' },
  '同学': { pinyin: 'tóngxué', gloss: 'compañero' },
  '汉语': { pinyin: 'hànyǔ', gloss: 'idioma chino' },
  '英语': { pinyin: 'yīngyǔ', gloss: 'inglés' },
  '西班牙语': { pinyin: 'xībānyáyǔ', gloss: 'español' },
  '话': { pinyin: 'huà', gloss: 'palabras / habla' },
  '说话': { pinyin: 'shuōhuà', gloss: 'hablar' },
  '课': { pinyin: 'kè', gloss: 'clase / lección' },
  '课本': { pinyin: 'kèběn', gloss: 'libro de texto' },
  '课程': { pinyin: 'kèchéng', gloss: 'currículo' },

  // Frequent single characters (HSK 1-2)
  '汉': { pinyin: 'hàn', gloss: 'chino (Han)' },
  '每': { pinyin: 'měi', gloss: 'cada' },
  '它': { pinyin: 'tā', gloss: 'eso' },
  '发': { pinyin: 'fā', gloss: 'emitir' },
  '音': { pinyin: 'yīn', gloss: 'sonido' },
  '聊': { pinyin: 'liáo', gloss: 'charlar' },
  '最': { pinyin: 'zuì', gloss: 'más / máximo' },
  '问': { pinyin: 'wèn', gloss: 'preguntar' },
  '部': { pinyin: 'bù', gloss: 'parte / sección' },
  '分': { pinyin: 'fēn', gloss: 'dividir / minuto' },
  '坚': { pinyin: 'jiān', gloss: 'firme' },
  '持': { pinyin: 'chí', gloss: 'mantener' },
  '加': { pinyin: 'jiā', gloss: 'añadir' },
  '油': { pinyin: 'yóu', gloss: 'aceite' },
  '件': { pinyin: 'jiàn', gloss: 'unidad / asunto' },
  '事': { pinyin: 'shì', gloss: 'asunto' },
  '情': { pinyin: 'qíng', gloss: 'sentimiento' },
  '因': { pinyin: 'yīn', gloss: 'causa' },
  '为': { pinyin: 'wèi', gloss: 'para / por' },
  '可': { pinyin: 'kě', gloss: 'poder' },
  '觉': { pinyin: 'jué', gloss: 'sentir' },
  '别': { pinyin: 'bié', gloss: 'otro / no' },
  '从': { pinyin: 'cóng', gloss: 'desde' },
  '把': { pinyin: 'bǎ', gloss: 'partícula ba / agarrar' },
  '让': { pinyin: 'ràng', gloss: 'dejar' },
  '跟': { pinyin: 'gēn', gloss: 'con / seguir' },
  '带': { pinyin: 'dài', gloss: 'llevar / cinturón' },
  '找': { pinyin: 'zhǎo', gloss: 'buscar' },
  '等': { pinyin: 'děng', gloss: 'esperar' },
  '放': { pinyin: 'fàng', gloss: 'poner' },
  '接': { pinyin: 'jiē', gloss: 'recibir' },
  '送': { pinyin: 'sòng', gloss: 'enviar' },
  '拿': { pinyin: 'ná', gloss: 'tomar' },
  '站': { pinyin: 'zhàn', gloss: 'estar de pie / estación' },
  '躺': { pinyin: 'tǎng', gloss: 'acostarse' },
  '跑': { pinyin: 'pǎo', gloss: 'correr' },
  '跳': { pinyin: 'tiào', gloss: 'saltar' },
  '唱': { pinyin: 'chàng', gloss: 'cantar' },
  '叫': { pinyin: 'jiào', gloss: 'llamar' },
  '请': { pinyin: 'qǐng', gloss: 'por favor' },
  '谢': { pinyin: 'xiè', gloss: 'agradecer' },
  '用': { pinyin: 'yòng', gloss: 'usar' },
  '钱': { pinyin: 'qián', gloss: 'dinero' },
  '付': { pinyin: 'fù', gloss: 'pagar' },
  '借': { pinyin: 'jiè', gloss: 'prestar' },
  '讲': { pinyin: 'jiǎng', gloss: 'contar' },
  '答': { pinyin: 'dá', gloss: 'responder' },
  '班': { pinyin: 'bān', gloss: 'clase / turno' },
  '校': { pinyin: 'xiào', gloss: 'escuela' },
  '窗': { pinyin: 'chuāng', gloss: 'ventana' },
  '桌': { pinyin: 'zhuō', gloss: 'mesa' },
  '椅': { pinyin: 'yǐ', gloss: 'silla' },
  '火': { pinyin: 'huǒ', gloss: 'fuego' },
  '风': { pinyin: 'fēng', gloss: 'viento' },
  '雨': { pinyin: 'yǔ', gloss: 'lluvia' },
  '雪': { pinyin: 'xuě', gloss: 'nieve' },
  '山': { pinyin: 'shān', gloss: 'montaña' },
  '河': { pinyin: 'hé', gloss: 'río' },
  '海': { pinyin: 'hǎi', gloss: 'mar' },
  '城': { pinyin: 'chéng', gloss: 'ciudad' },
  '市': { pinyin: 'shì', gloss: 'mercado' },
  '街': { pinyin: 'jiē', gloss: 'calle' },
  '路': { pinyin: 'lù', gloss: 'camino' },
  '车': { pinyin: 'chē', gloss: 'coche' },
  '船': { pinyin: 'chuán', gloss: 'barco' },
  '花': { pinyin: 'huā', gloss: 'flor' },
  '树': { pinyin: 'shù', gloss: 'árbol' },
  '草': { pinyin: 'cǎo', gloss: 'hierba' },
  '鸟': { pinyin: 'niǎo', gloss: 'pájaro' },
  '鱼': { pinyin: 'yú', gloss: 'pez' },
  '虫': { pinyin: 'chóng', gloss: 'insecto' },
  '狗': { pinyin: 'gǒu', gloss: 'perro' },
  '猫': { pinyin: 'māo', gloss: 'gato' },
  '猪': { pinyin: 'zhū', gloss: 'cerdo' },
  '牛': { pinyin: 'niú', gloss: 'vaca' },
  '羊': { pinyin: 'yáng', gloss: 'oveja' },
  '马': { pinyin: 'mǎ', gloss: 'caballo' },
  '鸡': { pinyin: 'jī', gloss: 'pollo' },
  '鸭': { pinyin: 'yā', gloss: 'pato' },
  '鹅': { pinyin: 'é', gloss: 'ganso' },
  '肉': { pinyin: 'ròu', gloss: 'carne' },
  '菜': { pinyin: 'cài', gloss: 'plato / verdura' },
  '饭': { pinyin: 'fàn', gloss: 'comida / arroz' },
  '面': { pinyin: 'miàn', gloss: 'fideo / cara' },
  '汤': { pinyin: 'tāng', gloss: 'sopa' },
  '蛋': { pinyin: 'dàn', gloss: 'huevo' },
  '果': { pinyin: 'guǒ', gloss: 'fruta' },
  '味': { pinyin: 'wèi', gloss: 'sabor' },
  '酒': { pinyin: 'jiǔ', gloss: 'alcohol' },
  '醋': { pinyin: 'cù', gloss: 'vinagre' },
  '盐': { pinyin: 'yán', gloss: 'sal' },
  '糖': { pinyin: 'táng', gloss: 'azúcar' },
  '红': { pinyin: 'hóng', gloss: 'rojo' },
  '白': { pinyin: 'bái', gloss: 'blanco' },
  '黑': { pinyin: 'hēi', gloss: 'negro' },
  '绿': { pinyin: 'lǜ', gloss: 'verde' },
  '蓝': { pinyin: 'lán', gloss: 'azul' },
  '黄': { pinyin: 'huáng', gloss: 'amarillo' },
  '粉': { pinyin: 'fěn', gloss: 'rosa / polvo' },
  '灰': { pinyin: 'huī', gloss: 'gris' },
  '紫': { pinyin: 'zǐ', gloss: 'violeta' },
  '橙': { pinyin: 'chéng', gloss: 'naranja' },
  '衣': { pinyin: 'yī', gloss: 'ropa' },
  '裙': { pinyin: 'qún', gloss: 'falda' },
  '鞋': { pinyin: 'xié', gloss: 'zapato' },
  '袜': { pinyin: 'wà', gloss: 'calcetín' },
  '伞': { pinyin: 'sǎn', gloss: 'paraguas' },
  '帽': { pinyin: 'mào', gloss: 'sombrero' },
  '镜': { pinyin: 'jìng', gloss: 'espejo' },
  '笔': { pinyin: 'bǐ', gloss: 'bolígrafo' },
  '纸': { pinyin: 'zhǐ', gloss: 'papel' },
  '报': { pinyin: 'bào', gloss: 'informe / periódico' },
  '刊': { pinyin: 'kān', gloss: 'publicación' },
  '店': { pinyin: 'diàn', gloss: 'tienda' },
  '厂': { pinyin: 'chǎng', gloss: 'fábrica' },
  '厨': { pinyin: 'chú', gloss: 'cocina' },
  '厕': { pinyin: 'cè', gloss: 'baño' },
  '厅': { pinyin: 'tīng', gloss: 'sala' },
  '室': { pinyin: 'shì', gloss: 'habitación' },
  '房': { pinyin: 'fáng', gloss: 'casa' },
  '楼': { pinyin: 'lóu', gloss: 'edificio' },
  '层': { pinyin: 'céng', gloss: 'piso / capa' },
  '港': { pinyin: 'gǎng', gloss: 'puerto' },
  '岛': { pinyin: 'dǎo', gloss: 'isla' },
  '洲': { pinyin: 'zhōu', gloss: 'continente' },
  '声': { pinyin: 'shēng', gloss: 'sonido' },
  '耳': { pinyin: 'ěr', gloss: 'oreja' },
  '眼': { pinyin: 'yǎn', gloss: 'ojo' },
  '鼻': { pinyin: 'bí', gloss: 'nariz' },
  '嘴': { pinyin: 'zuǐ', gloss: 'boca' },
  '脸': { pinyin: 'liǎn', gloss: 'cara' },
  '头': { pinyin: 'tóu', gloss: 'cabeza' },
  '身': { pinyin: 'shēn', gloss: 'cuerpo' },
  '脚': { pinyin: 'jiǎo', gloss: 'pie' },
  '胸': { pinyin: 'xiōng', gloss: 'pecho' },
  '背': { pinyin: 'bèi', gloss: 'espalda' },
  '腿': { pinyin: 'tuǐ', gloss: 'pierna' },
  '腰': { pinyin: 'yāo', gloss: 'cintura' },
  '肩': { pinyin: 'jiān', gloss: 'hombro' },
  '心': { pinyin: 'xīn', gloss: 'corazón' },
  '肝': { pinyin: 'gān', gloss: 'hígado' },
  '胃': { pinyin: 'wèi', gloss: 'estómago' },
  '肺': { pinyin: 'fèi', gloss: 'pulmón' },
  '肾': { pinyin: 'shèn', gloss: 'riñón' },
  '血': { pinyin: 'xuè', gloss: 'sangre' },
  '骨': { pinyin: 'gǔ', gloss: 'hueso' },
  '皮': { pinyin: 'pí', gloss: 'piel' },
  '毛': { pinyin: 'máo', gloss: 'pelo / vello' },
  '齿': { pinyin: 'chǐ', gloss: 'diente' },
  '舌': { pinyin: 'shé', gloss: 'lengua' },
  '脑': { pinyin: 'nǎo', gloss: 'cerebro' },
  '唇': { pinyin: 'chún', gloss: 'labio' },
  '眉': { pinyin: 'méi', gloss: 'ceja' },
  '脖': { pinyin: 'bó', gloss: 'cuello' },
  '乐': { pinyin: 'lè', gloss: 'feliz / música (yuè)' },
  '视': { pinyin: 'shì', gloss: 'ver / mirar' },
  '电': { pinyin: 'diàn', gloss: 'electricidad' },
  '一': { pinyin: 'yī', gloss: 'uno' },
  '希': { pinyin: 'xī', gloss: 'esperar / raro' },
  '望': { pinyin: 'wàng', gloss: 'mirar a lo lejos' },
  '希望': { pinyin: 'xīwàng', gloss: 'esperar / esperanza' },
  '害': { pinyin: 'hài', gloss: 'daño' },
  '怕': { pinyin: 'pà', gloss: 'temer' },
  '害怕': { pinyin: 'hàipà', gloss: 'tener miedo' },

  // HSK 3-4 formal-writing vocabulary (extension)
  '是否': { pinyin: 'shìfǒu', gloss: 'si (partícula interrogativa)' },
  '顺畅': { pinyin: 'shùnchàng', gloss: 'fluido' },
  '通顺': { pinyin: 'tōngshùn', gloss: 'fluido / coherente' },
  '标点': { pinyin: 'biāodiǎn', gloss: 'puntuación' },
  '恰当': { pinyin: 'qiàdàng', gloss: 'apropiado' },
  '模仿': { pinyin: 'mófǎng', gloss: 'imitar' },
  '优秀': { pinyin: 'yōuxiù', gloss: 'excelente' },
  '范文': { pinyin: 'fànwén', gloss: 'texto modelo' },
  '练习': { pinyin: 'liànxí', gloss: 'practicar' },
  '写作': { pinyin: 'xiězuò', gloss: 'escribir (composición)' },
  '逐步': { pinyin: 'zhúbù', gloss: 'gradualmente' },
  '提升': { pinyin: 'tíshēng', gloss: 'mejorar' },
  '表达': { pinyin: 'biǎodá', gloss: 'expresar' },
  '能力': { pinyin: 'nénglì', gloss: 'habilidad' },
  '语句': { pinyin: 'yǔjù', gloss: 'oración / frase' },
  '逻辑': { pinyin: 'luóji', gloss: 'lógica' },
  '通读': { pinyin: 'tōngdú', gloss: 'leer completo' },
  '全文': { pinyin: 'quánwén', gloss: 'texto completo' },
  '检查': { pinyin: 'jiǎnchá', gloss: 'revisar' },
  '一些': { pinyin: 'yìxiē', gloss: 'unos / algunos' },
  '首先': { pinyin: 'shǒuxiān', gloss: 'primero' },
  '其次': { pinyin: 'qícì', gloss: 'en segundo lugar' },
  '此外': { pinyin: 'cǐwài', gloss: 'además' },
  '明确': { pinyin: 'míngquè', gloss: 'claro / definido' },
  '文章': { pinyin: 'wénzhāng', gloss: 'artículo' },
  '目的': { pinyin: 'mùdì', gloss: 'objetivo' },
  '说明': { pinyin: 'shuōmíng', gloss: 'explicar' },
  '议论': { pinyin: 'yìlùn', gloss: 'debatir' },
  '叙事': { pinyin: 'xùshì', gloss: 'narrar' },
  '围绕': { pinyin: 'wéirào', gloss: 'girar en torno a' },
  '中心': { pinyin: 'zhōngxīn', gloss: 'centro' },
  '思想': { pinyin: 'sīxiǎng', gloss: 'pensamiento' },
  '列出': { pinyin: 'lièchū', gloss: 'listar' },
  '几个': { pinyin: 'jǐ gè', gloss: 'varios' },
  '关键': { pinyin: 'guānjiàn', gloss: 'clave' },
  '关键点': { pinyin: 'guānjiàn diǎn', gloss: 'punto clave' },
  '对应': { pinyin: 'duìyìng', gloss: 'corresponder' },
  '段落': { pinyin: 'duànluò', gloss: 'párrafo' },
  '段': { pinyin: 'duàn', gloss: 'segmento / párrafo' },
  '主旨': { pinyin: 'zhǔzhǐ', gloss: 'tema principal' },
  '开头': { pinyin: 'kāitóu', gloss: 'comienzo' },
  '开头句': { pinyin: 'kāitóu jù', gloss: 'oración inicial' },
  '要点': { pinyin: 'yàodiǎn', gloss: 'puntos clave' },
  '点明': { pinyin: 'diǎnmíng', gloss: 'señalar claramente' },
  '本段': { pinyin: 'běn duàn', gloss: 'este párrafo' },
  '随后': { pinyin: 'suíhòu', gloss: 'después' },
  '例子': { pinyin: 'lìzi', gloss: 'ejemplo' },
  '细节': { pinyin: 'xìjié', gloss: 'detalle' },
  '展开': { pinyin: 'zhǎnkāi', gloss: 'desarrollar' },
  '总结': { pinyin: 'zǒngjié', gloss: 'resumir' },
  '总结句': { pinyin: 'zǒngjié jù', gloss: 'oración conclusiva' },
  '收束': { pinyin: 'shōushù', gloss: 'concluir' },
  '注意': { pinyin: 'zhùyì', gloss: 'prestar atención' },
  '使用': { pinyin: 'shǐyòng', gloss: 'usar' },
  '连接': { pinyin: 'liánjiē', gloss: 'conectar' },
  '连接词': { pinyin: 'liánjiē cí', gloss: 'conector' },
  '层次': { pinyin: 'céngcì', gloss: 'nivel / jerarquía' },
  '分明': { pinyin: 'fēnmíng', gloss: 'claro' },
  '建议': { pinyin: 'jiànyì', gloss: 'sugerencia' },

  // Common single chars still missing
  '否': { pinyin: 'fǒu', gloss: 'no' },
  '顺': { pinyin: 'shùn', gloss: 'liso / conforme' },
  '畅': { pinyin: 'chàng', gloss: 'fluido' },
  '通': { pinyin: 'tōng', gloss: 'pasar / a través' },
  '标': { pinyin: 'biāo', gloss: 'marcar' },
  '恰': { pinyin: 'qià', gloss: 'exactamente' },
  '当': { pinyin: 'dāng', gloss: 'servir / cuando' },
  '模': { pinyin: 'mó', gloss: 'molde' },
  '仿': { pinyin: 'fǎng', gloss: 'imitar' },
  '优': { pinyin: 'yōu', gloss: 'excelente' },
  '秀': { pinyin: 'xiù', gloss: 'sobresaliente' },
  '范': { pinyin: 'fàn', gloss: 'modelo' },
  '练': { pinyin: 'liàn', gloss: 'practicar' },
  '习': { pinyin: 'xí', gloss: 'estudiar' },
  '作': { pinyin: 'zuò', gloss: 'hacer / obra' },
  '逐': { pinyin: 'zhú', gloss: 'perseguir / uno por uno' },
  '步': { pinyin: 'bù', gloss: 'paso' },
  '提': { pinyin: 'tí', gloss: 'levantar' },
  '升': { pinyin: 'shēng', gloss: 'subir' },
  '表': { pinyin: 'biǎo', gloss: 'expresar / tabla' },
  '达': { pinyin: 'dá', gloss: 'alcanzar' },
  '力': { pinyin: 'lì', gloss: 'fuerza' },
  '句': { pinyin: 'jù', gloss: 'oración (mp.)' },
  '语': { pinyin: 'yǔ', gloss: 'lenguaje' },
  '文': { pinyin: 'wén', gloss: 'lengua / escrito' },
  '全': { pinyin: 'quán', gloss: 'entero' },
  '读': { pinyin: 'dú', gloss: 'leer' },
  '检': { pinyin: 'jiǎn', gloss: 'examinar' },
  '查': { pinyin: 'chá', gloss: 'revisar' },
  '逻': { pinyin: 'luó', gloss: 'lógica (cptc.)' },
  '辑': { pinyin: 'jí', gloss: 'compilar' },
  '目': { pinyin: 'mù', gloss: 'ojo / ítem' },
  '思': { pinyin: 'sī', gloss: 'pensar' },
  '想': { pinyin: 'xiǎng', gloss: 'pensar' },
  '写': { pinyin: 'xiě', gloss: 'escribir' },
  '完': { pinyin: 'wán', gloss: 'terminar' },
  '再': { pinyin: 'zài', gloss: 'otra vez' },
  '给': { pinyin: 'gěi', gloss: 'dar' },
  '首': { pinyin: 'shǒu', gloss: 'cabeza / primero' },
  '其': { pinyin: 'qí', gloss: 'su' },
  '次': { pinyin: 'cì', gloss: 'próximo / vez' },
  '列': { pinyin: 'liè', gloss: 'listar' },
  '出': { pinyin: 'chū', gloss: 'salir' },
  '关': { pinyin: 'guān', gloss: 'cerrar / relacionar' },
  '键': { pinyin: 'jiàn', gloss: 'tecla / clave' },
  '对': { pinyin: 'duì', gloss: 'correcto / hacia' },
  '应': { pinyin: 'yīng', gloss: 'deber' },
  '主': { pinyin: 'zhǔ', gloss: 'principal' },
  '旨': { pinyin: 'zhǐ', gloss: 'propósito' },
  '本': { pinyin: 'běn', gloss: 'raíz / mp libros' },
  '随': { pinyin: 'suí', gloss: 'seguir' },
  '细': { pinyin: 'xì', gloss: 'fino' },
  '节': { pinyin: 'jié', gloss: 'nudo / festival' },
  '展': { pinyin: 'zhǎn', gloss: 'desplegar' },
  '开': { pinyin: 'kāi', gloss: 'abrir' },
  '总': { pinyin: 'zǒng', gloss: 'total' },
  '结': { pinyin: 'jié', gloss: 'atar / concluir' },
  '收': { pinyin: 'shōu', gloss: 'recibir' },
  '束': { pinyin: 'shù', gloss: 'atar / haz' },
  '注': { pinyin: 'zhù', gloss: 'notar' },
  '意': { pinyin: 'yì', gloss: 'idea' },
  '使': { pinyin: 'shǐ', gloss: 'usar / hacer' },
  '连': { pinyin: 'lián', gloss: 'conectar' },
  '接': { pinyin: 'jiē', gloss: 'recibir' },
  '词': { pinyin: 'cí', gloss: 'palabra' },
  '如': { pinyin: 'rú', gloss: 'como' },
  '层': { pinyin: 'céng', gloss: 'capa' },
  '此': { pinyin: 'cǐ', gloss: 'esto' },
  '外': { pinyin: 'wài', gloss: 'fuera' },
  '建': { pinyin: 'jiàn', gloss: 'construir' },
  '议': { pinyin: 'yì', gloss: 'discutir' },

  // Extended single-char coverage for descriptive vocabulary
  '烤': { pinyin: 'kǎo', gloss: 'asar' },
  '香': { pinyin: 'xiāng', gloss: 'aromático' },
  '周': { pinyin: 'zhōu', gloss: 'semana / alrededor' },
  '末': { pinyin: 'mò', gloss: 'final' },
  '郊': { pinyin: 'jiāo', gloss: 'suburbio' },
  '葡': { pinyin: 'pú', gloss: 'uva (cptc.)' },
  '萄': { pinyin: 'táo', gloss: 'uva (cptc.)' },
  '园': { pinyin: 'yuán', gloss: 'jardín' },
  '品': { pinyin: 'pǐn', gloss: 'producto / degustar' },
  '尝': { pinyin: 'cháng', gloss: 'probar' },
  '尔': { pinyin: 'ěr', gloss: 'tú (clásico)' },
  '贝': { pinyin: 'bèi', gloss: 'concha' },
  '克': { pinyin: 'kè', gloss: 'gramo / vencer' },
  '参': { pinyin: 'cān', gloss: 'participar' },
  '闹': { pinyin: 'nào', gloss: 'ruidoso' },
  '集': { pinyin: 'jí', gloss: 'reunir / mercado' },
  '工': { pinyin: 'gōng', gloss: 'trabajo' },
  '艺': { pinyin: 'yì', gloss: 'arte' },
  '鲜': { pinyin: 'xiān', gloss: 'fresco' },
  '时': { pinyin: 'shí', gloss: 'tiempo' },
  '遇': { pinyin: 'yù', gloss: 'encontrar' },
  '到': { pinyin: 'dào', gloss: 'llegar' },
  '言': { pinyin: 'yán', gloss: 'habla' },
  '障': { pinyin: 'zhàng', gloss: 'barrera' },
  '碍': { pinyin: 'ài', gloss: 'obstruir' },
  '但': { pinyin: 'dàn', gloss: 'pero' },
  '地': { pinyin: 'dì', gloss: 'tierra / lugar' },
  '友': { pinyin: 'yǒu', gloss: 'amigo' },
  '总': { pinyin: 'zǒng', gloss: 'total / siempre' },
  '耐': { pinyin: 'nài', gloss: 'soportar' },
  '期': { pinyin: 'qī', gloss: 'período' },
  '下': { pinyin: 'xià', gloss: 'abajo' },
  '感': { pinyin: 'gǎn', gloss: 'sentir' },
  '受': { pinyin: 'shòu', gloss: 'recibir' },
  '悠': { pinyin: 'yōu', gloss: 'lejano / tranquilo' },
  '奏': { pinyin: 'zòu', gloss: 'tocar (música)' },
  '丰': { pinyin: 'fēng', gloss: 'abundante' },
  '富': { pinyin: 'fù', gloss: 'rico' },
  '彩': { pinyin: 'cǎi', gloss: 'colorido' },
  '化': { pinyin: 'huà', gloss: 'transformar' },
  '流': { pinyin: 'liú', gloss: 'fluir' },
  '忘': { pinyin: 'wàng', gloss: 'olvidar' },
  '返': { pinyin: 'fǎn', gloss: 'regresar' },
  '洒': { pinyin: 'sǎ', gloss: 'esparcir' },
  '阳': { pinyin: 'yáng', gloss: 'sol' },
  '光': { pinyin: 'guāng', gloss: 'luz' },
  '宽': { pinyin: 'kuān', gloss: 'ancho' },
  '阔': { pinyin: 'kuò', gloss: 'vasto' },
  '街': { pinyin: 'jiē', gloss: 'calle' },
  '道': { pinyin: 'dào', gloss: 'camino' },
  '踢': { pinyin: 'tī', gloss: 'patear' },
  '足': { pinyin: 'zú', gloss: 'pie' },
  '球': { pinyin: 'qiú', gloss: 'pelota' },
  '探': { pinyin: 'tàn', gloss: 'explorar' },
  '戈': { pinyin: 'gē', gloss: 'lanza' },
  '弥': { pinyin: 'mí', gloss: 'llenar' },
  '漫': { pinyin: 'màn', gloss: 'esparcirse' },
  '空': { pinyin: 'kōng', gloss: 'vacío' },
  '气': { pinyin: 'qì', gloss: 'aire' },
  '午': { pinyin: 'wǔ', gloss: 'mediodía' },
  '清': { pinyin: 'qīng', gloss: 'claro' },
  '晨': { pinyin: 'chén', gloss: 'amanecer' },
  '杯': { pinyin: 'bēi', gloss: 'taza (m.p.)' },
  '浓': { pinyin: 'nóng', gloss: 'denso' },
  '郁': { pinyin: 'yù', gloss: 'exuberante' },
  '啡': { pinyin: 'fēi', gloss: 'café (cptc.)' },
  '咖': { pinyin: 'kā', gloss: 'café (cptc.)' },
  '吉': { pinyin: 'jí', gloss: 'auspicioso' },
  '弹': { pinyin: 'dàn', gloss: 'tocar (cuerdas)' },
  '们': { pinyin: 'men', gloss: 'sufijo plural' },
  '起': { pinyin: 'qǐ', gloss: 'levantarse' },
  '布': { pinyin: 'bù', gloss: 'tela / anunciar' },
  '宜': { pinyin: 'yí', gloss: 'adecuado' },
  '诺': { pinyin: 'nuò', gloss: 'prometer' },
  '艾': { pinyin: 'ài', gloss: 'Ai (nombre)' },
  '利': { pinyin: 'lì', gloss: 'beneficio' },
  '斯': { pinyin: 'sī', gloss: 'esto (clásico)' },
  '手': { pinyin: 'shǒu', gloss: 'mano' }
};

// ==========================================
// 2. ARABIC LEXICON (High Frequency & Vowels)
// (Exported from ./arabicOfflineDict.js to avoid circular dependencies)
// ==========================================

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
    this.hasAuxiliary = true;
    this.hasTranslit = true;
    this.requiresTranslit = true;
    this.translitKey = 'pinyin';
    this.offlineDict = CHINESE_OFFLINE_DICT;
  }

  tokenize(text, nativeLang = 'es') {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    return this.tokenizeFallback(cleanStr, nativeLang);
  }

  tokenizeFallback(cleanStr, nativeLang = 'es') {
    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    const tokens = [];
    let i = 0;
    while (i < cleanStr.length) {
      const remaining = cleanStr.slice(i);
      // Whitespace
      const spaceMatch = remaining.match(/^\s+/);
      if (spaceMatch) {
        i += spaceMatch[0].length;
        continue;
      }
      // Punctuation
      const punctMatch = remaining.match(/^([，。！？；：、“”‘’（）《》…—,.!?;:'"()¿?¡!/\-_—\s\t،؛؟ـ]+)/);
      if (punctMatch) {
        const p = punctMatch[1];
        tokens.push({
          text: p,
          word: p,
          auxiliary: null,
          pinyin: null,
          gloss: null,
          isPunctuation: true
        });
        i += p.length;
        continue;
      }

      // Longest prefix match in offline dictionary (up to 6 chars)
      let dictMatched = false;
      for (let len = Math.min(6, remaining.length); len >= 2; len--) {
        const candidate = remaining.slice(0, len);
        const entry = this.offlineDict[candidate];
        if (entry) {
          const offlineGloss = isSpanishNative ? (entry.gloss || null) : null;
          tokens.push({
            text: candidate,
            word: candidate,
            auxiliary: entry.auxiliary || entry.pinyin || null,
            pinyin: entry.auxiliary || entry.pinyin || null,
            gloss: offlineGloss,
            glossSource: (isSpanishNative && offlineGloss) ? 'offline' : null,
            targetLang: 'zh',
            nativeLang: nativeLang || 'es',
            isPunctuation: false
          });
          i += len;
          dictMatched = true;
          break;
        }
      }
      if (dictMatched) continue;

      // Single CJK Character
      if (/^[\u4E00-\u9FFF]/.test(remaining)) {
        const char = remaining[0];
        const entry = this.offlineDict[char];
        const offlineGloss = isSpanishNative ? (entry?.gloss || null) : null;
        tokens.push({
          text: char,
          word: char,
          auxiliary: entry?.auxiliary || entry?.pinyin || null,
          pinyin: entry?.auxiliary || entry?.pinyin || null,
          gloss: offlineGloss,
          glossSource: (isSpanishNative && offlineGloss) ? 'offline' : null,
          targetLang: 'zh',
          nativeLang: nativeLang || 'es',
          isPunctuation: false
        });
        i += 1;
        continue;
      }

      // Latin word or digits
      const wordMatch = remaining.match(/^[a-zA-Z0-9]+/);
      if (wordMatch) {
        const w = wordMatch[0];
        tokens.push({
          text: w,
          word: w,
          auxiliary: null,
          pinyin: null,
          gloss: null,
          glossSource: null,
          targetLang: 'zh',
          nativeLang: nativeLang || 'es',
          isPunctuation: false
        });
        i += w.length;
        continue;
      }

      // Any remaining character (handles surrogate pairs and special Unicode safely)
      const codePoint = remaining.codePointAt(0);
      const single = codePoint ? String.fromCodePoint(codePoint) : remaining[0];
      tokens.push({
        text: single,
        word: single,
        auxiliary: null,
        pinyin: null,
        gloss: null,
        glossSource: null,
        targetLang: 'zh',
        nativeLang: nativeLang || 'es',
        isPunctuation: PUNCTUATION_REGEX.test(single)
      });
      i += single.length;
    }
    return tokens;
  }

  lookupOffline(word, nativeLang = 'es') {
    if (!word) return null;
    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    if (!isSpanishNative) return null;
    const clean = word.trim();
    return this.offlineDict[clean] || null;
  }

  isTokenComplete(token, nativeLang = 'es') {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss) return false;

    if (token.glossSource === 'manual') return true;

    const targetNative = (nativeLang || 'es').toLowerCase().split('-')[0];
    const tokenNative = (token.nativeLang || '').toLowerCase().split('-')[0];
    const tokenTarget = (token.targetLang || '').toLowerCase().split('-')[0];

    if (tokenTarget && tokenTarget !== 'zh') return false;

    const aux = typeof (token.auxiliary || token.pinyin) === 'string' ? (token.auxiliary || token.pinyin).trim() : '';

    // Verified AI gloss: MUST match targetLang ('zh') and requested nativeLang
    if (token.glossSource === 'ai') {
      if (tokenNative && tokenNative !== targetNative) return false;
      if (!tokenNative) return false;
      if (/[\u4E00-\u9FFF]/.test(w)) {
        return Boolean(aux);
      }
      return true;
    }

    // Verified offline dictionary gloss: strictly valid ONLY when nativeLang === 'es'
    if (token.glossSource === 'offline') {
      if (targetNative !== 'es') return false;
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        const entryAux = entry.auxiliary || entry.pinyin || aux;
        if (/[\u4E00-\u9FFF]/.test(w)) {
          return Boolean(entryAux);
        }
        return true;
      }
    }

    // Direct offline fallback check for nativeLang === 'es'
    if (targetNative === 'es') {
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        const entryAux = entry.auxiliary || entry.pinyin || aux;
        if (/[\u4E00-\u9FFF]/.test(w)) {
          return Boolean(entryAux);
        }
        return true;
      }
    }

    return false;
  }
}

/**
 * Normalizes an Arabic string for robust matching across diacritical,
 * orthographic, and Unicode variants without modifying the display text.
 */
export function normalizeArabicForMatching(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\uFEFF\u061C]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, '\u0627')
    .replace(/[\u0649\u06CD\u06D0\u06D1]/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .trim()
    .toLowerCase();
}

export class ArabicGlossStrategy {
  constructor() {
    this.code = 'ar';
    this.name = 'Árabe';
    this.hasAuxiliary = true;
    this.hasTranslit = true;
    this.requiresTranslit = true;
    this.translitKey = 'translit';
    this.offlineDict = ARABIC_OFFLINE_DICT;
    this._normalizedDict = new Map();
    for (const [key, val] of Object.entries(ARABIC_OFFLINE_DICT)) {
      const norm = normalizeArabicForMatching(key);
      if (norm && !this._normalizedDict.has(norm)) {
        this._normalizedDict.set(norm, val);
      }
    }
  }

  tokenize(text, nativeLang = 'es') {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    const tokens = [];
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('ar', { granularity: 'word' });
        const segments = [...segmenter.segment(cleanStr)];
        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;
          const isPunctuation = !seg.isWordLike || PUNCTUATION_REGEX.test(w);
          const entry = isPunctuation ? null : this.lookupOffline(w, nativeLang);
          const translit = isPunctuation ? null : (entry?.translit || getArabicTransliteration(w));

          tokens.push({
            text: w,
            word: w,
            auxiliary: translit,
            pinyin: null,
            translit: translit,
            gloss: isPunctuation ? null : (entry?.gloss || null),
            glossSource: isPunctuation ? undefined : ((isSpanishNative && entry?.gloss) ? 'offline' : null),
            targetLang: 'ar',
            nativeLang: nativeLang || 'es',
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
      const entry = isPunctuation ? null : this.lookupOffline(w, nativeLang);
      const translit = isPunctuation ? null : (entry?.translit || getArabicTransliteration(w));

      tokens.push({
        text: w,
        word: w,
        auxiliary: translit,
        pinyin: null,
        translit: translit,
        gloss: isPunctuation ? null : (entry?.gloss || null),
        glossSource: isPunctuation ? undefined : ((isSpanishNative && entry?.gloss) ? 'offline' : null),
        targetLang: 'ar',
        nativeLang: nativeLang || 'es',
        isPunctuation
      });
    }
    return tokens;
  }

  lookupOffline(word, nativeLang = 'es') {
    if (!word) return null;
    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    if (!isSpanishNative) return null;
    const clean = word.trim();
    if (this.offlineDict[clean]) return this.offlineDict[clean];

    const norm = normalizeArabicForMatching(clean);
    if (this._normalizedDict.has(norm)) {
      return this._normalizedDict.get(norm);
    }

    // Prefix stripping: e.g. "والسلام" -> "و" + "السلام"
    if (norm.startsWith('و') && norm.length > 2) {
      const rest = norm.slice(1);
      if (this._normalizedDict.has(rest)) {
        const base = this._normalizedDict.get(rest);
        return {
          translit: 'wa-' + (base.translit || ''),
          gloss: 'y ' + (base.gloss || '')
        };
      }
    }
    if (norm.startsWith('ف') && norm.length > 2) {
      const rest = norm.slice(1);
      if (this._normalizedDict.has(rest)) {
        const base = this._normalizedDict.get(rest);
        return {
          translit: 'fa-' + (base.translit || ''),
          gloss: 'entonces ' + (base.gloss || '')
        };
      }
    }
    if (norm.startsWith('ب') && norm.length > 2) {
      const rest = norm.slice(1);
      if (this._normalizedDict.has(rest)) {
        const base = this._normalizedDict.get(rest);
        return {
          translit: 'bi-' + (base.translit || ''),
          gloss: 'con/en ' + (base.gloss || '')
        };
      }
    }
    if (norm.startsWith('ل') && norm.length > 2) {
      const rest = norm.slice(1);
      if (this._normalizedDict.has(rest)) {
        const base = this._normalizedDict.get(rest);
        return {
          translit: 'li-' + (base.translit || ''),
          gloss: 'para ' + (base.gloss || '')
        };
      }
    }

    return null;
  }

  isTokenComplete(token, nativeLang = 'es') {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss) return false;

    if (token.glossSource === 'manual') return true;

    const targetNative = (nativeLang || 'es').toLowerCase().split('-')[0];
    const tokenNative = (token.nativeLang || '').toLowerCase().split('-')[0];
    const tokenTarget = (token.targetLang || '').toLowerCase().split('-')[0];

    if (tokenTarget && tokenTarget !== 'ar') return false;

    // Verified AI gloss: MUST match active targetLang ('ar') and requested nativeLang
    if (token.glossSource === 'ai') {
      if (tokenNative && tokenNative !== targetNative) return false;
      if (!tokenNative) return false;
      return true;
    }

    // Verified offline dictionary gloss: strictly valid ONLY when nativeLang === 'es'
    if (token.glossSource === 'offline') {
      if (targetNative !== 'es') return false;
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        return true;
      }
    }

    // Direct offline lookup fallback for nativeLang === 'es'
    if (targetNative === 'es') {
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        return true;
      }
    }

    return false;
  }
}

export class PolishGlossStrategy {
  constructor() {
    this.code = 'pl';
    this.name = 'Polaco';
    this.hasAuxiliary = false;
    this.hasTranslit = false;
    this.requiresTranslit = false;
    this.translitKey = null;
    this.offlineDict = POLISH_OFFLINE_DICT;
  }

  tokenize(text, nativeLang = 'es') {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('pl', { granularity: 'word' });
        const segments = [...segmenter.segment(cleanStr)];
        const tokens = [];
        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;
          const isPunctuation = !seg.isWordLike || PUNCTUATION_REGEX.test(w);
          const entry = isPunctuation ? null : this.lookupOffline(w, nativeLang);

          tokens.push({
            text: w,
            word: w,
            auxiliary: null,
            pinyin: null,
            translit: null,
            gloss: isPunctuation ? null : (entry?.gloss || null),
            glossSource: isPunctuation ? undefined : ((isSpanishNative && entry?.gloss) ? 'offline' : null),
            targetLang: 'pl',
            nativeLang: nativeLang || 'es',
            isPunctuation
          });
        }
        if (tokens.length > 0) return tokens;
      }
    } catch (e) {
      console.warn('Intl.Segmenter fallback in PolishGlossStrategy:', e);
    }

    const parts = cleanStr.split(/([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^\sa-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/).filter(Boolean);
    const tokens = [];

    for (const part of parts) {
      const w = part.trim();
      if (!w) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      const entry = isPunctuation ? null : this.lookupOffline(w, nativeLang);

      tokens.push({
        text: w,
        word: w,
        auxiliary: null,
        pinyin: null,
        translit: null,
        gloss: isPunctuation ? null : (entry?.gloss || null),
        glossSource: isPunctuation ? undefined : ((isSpanishNative && entry?.gloss) ? 'offline' : null),
        targetLang: 'pl',
        nativeLang: nativeLang || 'es',
        isPunctuation
      });
    }
    return tokens;
  }

  lookupOffline(word, nativeLang = 'es') {
    if (!word) return null;
    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    if (!isSpanishNative) return null;
    const clean = word.trim().toLowerCase();
    return this.offlineDict[clean] || null;
  }

  isTokenComplete(token, nativeLang = 'es') {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss) return false;

    if (token.glossSource === 'manual') return true;

    const targetNative = (nativeLang || 'es').toLowerCase().split('-')[0];
    const tokenNative = (token.nativeLang || '').toLowerCase().split('-')[0];
    const tokenTarget = (token.targetLang || '').toLowerCase().split('-')[0];

    if (tokenTarget && tokenTarget !== 'pl') return false;

    // Verified AI gloss: MUST match active targetLang ('pl') and requested nativeLang
    if (token.glossSource === 'ai') {
      if (tokenNative && tokenNative !== targetNative) return false;
      if (!tokenNative) return false;
      return true;
    }

    // Verified offline dictionary gloss: strictly valid ONLY when nativeLang === 'es'
    if (token.glossSource === 'offline') {
      if (targetNative !== 'es') return false;
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        return true;
      }
    }

    // Direct offline lookup fallback for nativeLang === 'es'
    if (targetNative === 'es') {
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        return true;
      }
    }

    return false;
  }
}

// ==========================================
// 4. TURKISH LEXICON (Latin Script, NO Translit)
// ==========================================
export const TURKISH_OFFLINE_DICT = {
  // Greetings & Courtesies
  'merhaba': { gloss: 'hola' },
  'selam': { gloss: 'hola / saludos' },
  'günaydın': { gloss: 'buenos días' },
  'tünaydın': { gloss: 'buenas tardes' },
  'akşamlar': { gloss: 'tardes / noches' },
  'geceler': { gloss: 'noches' },
  'hoşça': { gloss: 'adiós (pásalo bien)' },
  'hoşçakal': { gloss: 'adiós' },
  'kal': { gloss: 'quédate' },
  'görüşürüz': { gloss: 'nos vemos / hasta la vista' },
  'teşekkürler': { gloss: 'gracias' },
  'teşekkür': { gloss: 'agradecimiento' },
  'ederim': { gloss: 'hago / doy' },
  'sağol': { gloss: 'gracias' },
  'lütfen': { gloss: 'por favor' },
  'rica': { gloss: 'de nada / por favor' },
  'özür': { gloss: 'disculpa / perdón' },
  'dilerim': { gloss: 'deseo / pido' },
  'affedersiniz': { gloss: 'disculpe / perdón' },
  'afedersiniz': { gloss: 'disculpe' },
  'hoş': { gloss: 'agradable / bienvenido' },
  'geldiniz': { gloss: 'bienvenidos' },
  'bulduk': { gloss: 'gracias (respuesta a bienvenidos)' },
  'nasılsın': { gloss: 'cómo estás' },
  'nasılsınız': { gloss: 'cómo está / están' },
  'iyiyim': { gloss: 'estoy bien' },

  // Question Words & Conjunctions
  'bir': { gloss: 'un / una / uno' },
  'ne': { gloss: 'qué' },
  'nasıl': { gloss: 'cómo' },
  'kim': { gloss: 'quién' },
  'nerede': { gloss: 'dónde' },
  'nereye': { gloss: 'adónde' },
  'nereden': { gloss: 'de dónde' },
  'zaman': { gloss: 'tiempo / cuándo' },
  'neden': { gloss: 'por qué' },
  'niçin': { gloss: 'por qué / para qué' },
  'niye': { gloss: 'por qué (coloquial)' },
  'kaç': { gloss: 'cuánto / cuántos' },
  'kadar': { gloss: 'hasta / tanto como' },
  'hangi': { gloss: 'cuál / qué' },
  'evet': { gloss: 'sí' },
  'hayır': { gloss: 'no' },
  'yok': { gloss: 'no hay / no existe' },
  'var': { gloss: 'hay / existe / tengo' },
  've': { gloss: 'y' },
  'veya': { gloss: 'o / u' },
  'ama': { gloss: 'pero' },
  'fakat': { gloss: 'pero / sin embargo' },
  'lakin': { gloss: 'pero' },
  'çünkü': { gloss: 'porque' },
  'ile': { gloss: 'con / y' },
  'için': { gloss: 'para / por' },
  'gibi': { gloss: 'como / parecido a' },
  'de': { gloss: 'también / en' },
  'da': { gloss: 'también / en' },
  'ki': { gloss: 'que (conjunción)' },
  'mi': { gloss: '¿acaso? (pregunta)' },
  'mı': { gloss: '¿acaso? (pregunta)' },
  'mu': { gloss: '¿acaso? (pregunta)' },
  'mü': { gloss: '¿acaso? (pregunta)' },
  'ise': { gloss: 'en cuanto a / si' },
  'eğer': { gloss: 'si (condicional)' },
  'diye': { gloss: 'diciendo que / para que' },

  // Pronouns & Demonstratives
  'ben': { gloss: 'yo' },
  'sen': { gloss: 'tú' },
  'o': { gloss: 'él / ella / eso' },
  'biz': { gloss: 'nosotros' },
  'siz': { gloss: 'ustedes / vosotros / usted' },
  'onlar': { gloss: 'ellos / ellas' },
  'benim': { gloss: 'mi / mío' },
  'senin': { gloss: 'tu / tuyo' },
  'onun': { gloss: 'su / suyo' },
  'bizim': { gloss: 'nuestro' },
  'sizin': { gloss: 'vuestro / su' },
  'onların': { gloss: 'su / de ellos' },
  'bana': { gloss: 'a mí / me' },
  'sana': { gloss: 'a ti / te' },
  'ona': { gloss: 'a él / a ella / le' },
  'bize': { gloss: 'a nosotros / nos' },
  'size': { gloss: 'a ustedes / os' },
  'onlara': { gloss: 'a ellos / les' },
  'beni': { gloss: 'a mí (acusativo)' },
  'seni': { gloss: 'a ti (acusativo)' },
  'onu': { gloss: 'a él / a ella / lo / la' },
  'bizi': { gloss: 'a nosotros (acusativo)' },
  'sizi': { gloss: 'a ustedes (acusativo)' },
  'onları': { gloss: 'a ellos / los / las' },
  'bende': { gloss: 'en mí / conmigo' },
  'sende': { gloss: 'en ti / contigo' },
  'onda': { gloss: 'en él / en ella' },
  'benden': { gloss: 'de mí / desde mí' },
  'senden': { gloss: 'de ti / desde ti' },
  'ondan': { gloss: 'de él / de ella' },
  'bu': { gloss: 'este / esta / esto' },
  'şu': { gloss: 'ese / esa / eso' },
  'bunlar': { gloss: 'estos / estas' },
  'şunlar': { gloss: 'esos / esas' },
  'burada': { gloss: 'aquí' },
  'şurada': { gloss: 'ahí' },
  'orada': { gloss: 'allí' },
  'buraya': { gloss: 'aquí (dirección)' },
  'oraya': { gloss: 'allá (dirección)' },
  'kendi': { gloss: 'propio / sí mismo' },
  'kendim': { gloss: 'yo mismo' },
  'kendin': { gloss: 'tú mismo' },
  'herkes': { gloss: 'todos / todo el mundo' },
  'hepsi': { gloss: 'todos ellos / todo' },
  'biri': { gloss: 'alguien / uno de ellos' },
  'şey': { gloss: 'cosa' },
  'hiç': { gloss: 'nada / nunca' },
  'hiçbir': { gloss: 'ningún / ninguno' },

  // Common Adjectives & Adverbs
  'iyi': { gloss: 'bueno / bien' },
  'güzel': { gloss: 'bonito / hermoso / bien' },
  'kötü': { gloss: 'malo' },
  'büyük': { gloss: 'grande' },
  'küçük': { gloss: 'pequeño' },
  'yeni': { gloss: 'nuevo' },
  'eski': { gloss: 'viejo / antiguo' },
  'genç': { gloss: 'joven' },
  'kolay': { gloss: 'fácil' },
  'zor': { gloss: 'difícil' },
  'çok': { gloss: 'mucho / muy' },
  'az': { gloss: 'poco' },
  'daha': { gloss: 'más / aún' },
  'en': { gloss: 'el más (superlativo)' },
  'şimdi': { gloss: 'ahora' },
  'bugün': { gloss: 'hoy' },
  'yarın': { gloss: 'mañana' },
  'dün': { gloss: 'ayer' },
  'her': { gloss: 'cada' },
  'biraz': { gloss: 'un poco' },
  'doğru': { gloss: 'correcto / hacia' },
  'yanlış': { gloss: 'incorrecto / error' },
  'mutlu': { gloss: 'feliz' },
  'üzgün': { gloss: 'triste' },
  'yorgun': { gloss: 'cansado' },
  'aç': { gloss: 'hambriento / abre' },
  'tok': { gloss: 'satisfecho / lleno' },
  'sıcak': { gloss: 'caliente / cálido' },
  'soğuk': { gloss: 'frío' },
  'hızlı': { gloss: 'rápido' },
  'yavaş': { gloss: 'lento / despacio' },
  'erken': { gloss: 'temprano' },
  'geç': { gloss: 'tarde' },

  // Common Nouns
  'ev': { gloss: 'casa' },
  'evde': { gloss: 'en casa' },
  'eve': { gloss: 'a casa' },
  'iş': { gloss: 'trabajo' },
  'işte': { gloss: 'en el trabajo' },
  'insan': { gloss: 'humano / persona' },
  'insanlar': { gloss: 'personas / gente' },
  'adam': { gloss: 'hombre' },
  'kadın': { gloss: 'mujer' },
  'çocuk': { gloss: 'niño / hijo' },
  'çocuklar': { gloss: 'niños' },
  'arkadaş': { gloss: 'amigo' },
  'arkadaşlar': { gloss: 'amigos' },
  'kitap': { gloss: 'libro' },
  'kitabı': { gloss: 'el libro (acusativo)' },
  'su': { gloss: 'agua' },
  'suyu': { gloss: 'el agua (acusativo)' },
  'çay': { gloss: 'té' },
  'kahve': { gloss: 'café' },
  'ekmek': { gloss: 'pan / sembrar' },
  'yemek': { gloss: 'comida / comer' },
  'zaman': { gloss: 'tiempo' },
  'gün': { gloss: 'día' },
  'gece': { gloss: 'noche' },
  'sabah': { gloss: 'mañana' },
  'akşam': { gloss: 'tarde / noche' },
  'hafta': { gloss: 'semana' },
  'ay': { gloss: 'mes / luna' },
  'yıl': { gloss: 'año' },
  'sene': { gloss: 'año' },
  'para': { gloss: 'dinero' },
  'şehir': { gloss: 'ciudad' },
  'ülke': { gloss: 'país' },
  'dil': { gloss: 'idioma / lengua' },
  'türkçe': { gloss: 'turco (idioma)' },
  'ispanyolca': { gloss: 'español (idioma)' },
  'ingilizce': { gloss: 'inglés (idioma)' },
  'dünya': { gloss: 'mundo' },
  'hayat': { gloss: 'vida' },
  'soru': { gloss: 'pregunta' },
  'cevap': { gloss: 'respuesta' },
  'kapı': { gloss: 'puerta' },
  'araba': { gloss: 'auto / coche' },
  'yol': { gloss: 'camino / ruta' },
  'masa': { gloss: 'mesa' },
  'okul': { gloss: 'escuela' },
  'ders': { gloss: 'clase / lección' },
  'hastane': { gloss: 'hospital' },
  'doktor': { gloss: 'médico / doctor' },
  'anne': { gloss: 'madre / mamá' },
  'baba': { gloss: 'padre / papá' },
  'kardeş': { gloss: 'hermano / hermana' },

  // Common Verbs (Infinitive & Inflected)
  'olmak': { gloss: 'ser / estar / ocurrir' },
  'etmek': { gloss: 'hacer' },
  'yapmak': { gloss: 'hacer' },
  'gitmek': { gloss: 'ir' },
  'gelmek': { gloss: 'venir / llegar' },
  'almak': { gloss: 'tomar / comprar / recibir' },
  'vermek': { gloss: 'dar' },
  'istemek': { gloss: 'querer / desear' },
  'bilmek': { gloss: 'saber / conocer' },
  'görmek': { gloss: 'ver' },
  'bakmak': { gloss: 'mirar' },
  'duymak': { gloss: 'oír / sentir' },
  'dinlemek': { gloss: 'escuchar' },
  'konuşmak': { gloss: 'hablar / conversar' },
  'okumak': { gloss: 'leer / estudiar' },
  'yazmak': { gloss: 'escribir' },
  'çalışmak': { gloss: 'trabajar / intentar' },
  'öğrenmek': { gloss: 'aprender' },
  'öğretmek': { gloss: 'enseñar' },
  'anlamak': { gloss: 'entender / comprender' },
  'içmek': { gloss: 'beber / tomar' },
  'sevmek': { gloss: 'amar / querer / gustar' },
  'yaşamak': { gloss: 'vivir' },
  'bulmak': { gloss: 'encontrar' },
  'düşünmek': { gloss: 'pensar' },
  'başlamak': { gloss: 'empezar / comenzar' },
  'bitmek': { gloss: 'terminar / acabarse' },
  'oturmak': { gloss: 'sentarse / residir' },
  'kalkmak': { gloss: 'levantarse' },
  'uyumak': { gloss: 'dormir' },
  'uyanmak': { gloss: 'despertarse' },
  'istiyorum': { gloss: 'quiero' },
  'istiyorsun': { gloss: 'quieres' },
  'istiyor': { gloss: 'quiere' },
  'istiyoruz': { gloss: 'queremos' },
  'istersin': { gloss: 'quieres (aoristo)' },
  'isterim': { gloss: 'quisiera / me gustaría' },
  'biliyorum': { gloss: 'sé' },
  'bilmiyorum': { gloss: 'no sé' },
  'anlıyorum': { gloss: 'entiendo' },
  'anlamıyorum': { gloss: 'no entiendo' },
  'geliyorum': { gloss: 'vengo / voy de camino' },
  'gidiyorum': { gloss: 'me voy / voy' },
  'yapıyorum': { gloss: 'hago / estoy haciendo' },
  'seviyorum': { gloss: 'amo / me gusta' },
  'görüyorum': { gloss: 'veo' },
  'konuşuyorum': { gloss: 'hablo' },
  'yaparım': { gloss: 'lo hago / haré' },
  'giderim': { gloss: 'iré / suelo ir' },
  'gelirim': { gloss: 'iré / vendré' },
  'olur': { gloss: 'de acuerdo / sucede' },
  'olmaz': { gloss: 'no es posible / imposible' },
  'oldu': { gloss: 'sucedió / listo / fue' },
  'gitti': { gloss: 'se fue' },
  'geldi': { gloss: 'vino / llegó' },
  'yaptı': { gloss: 'hizo' },
  'dedi': { gloss: 'dijo' },
  'dedim': { gloss: 'dije' },
  'söyledi': { gloss: 'dijo / expresó' },
  'yoktur': { gloss: 'no hay (certeza)' },
  'vardır': { gloss: 'ciertamente hay' }
};

export class TurkishGlossStrategy {
  constructor() {
    this.code = 'tr';
    this.name = 'Turco';
    this.hasAuxiliary = false;
    this.hasTranslit = false;
    this.requiresTranslit = false;
    this.translitKey = null;
    this.offlineDict = TURKISH_OFFLINE_DICT;
  }

  tokenize(text, nativeLang = 'es') {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('tr', { granularity: 'word' });
        const segments = [...segmenter.segment(cleanStr)];
        const tokens = [];
        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;
          const isPunctuation = !seg.isWordLike || PUNCTUATION_REGEX.test(w);
          const entry = isPunctuation ? null : this.lookupOffline(w, nativeLang);

          tokens.push({
            text: w,
            word: w,
            targetLang: 'tr',
            nativeLang: nativeLang || 'es',
            auxiliary: null,
            pinyin: null,
            translit: null,
            gloss: isPunctuation ? null : (entry?.gloss || null),
            glossSource: isPunctuation ? undefined : ((isSpanishNative && entry?.gloss) ? 'offline' : null),
            isPunctuation
          });
        }
        if (tokens.length > 0) return tokens;
      }
    } catch (e) {
      console.warn('Intl.Segmenter fallback in TurkishGlossStrategy:', e);
    }

    const parts = cleanStr.split(/([a-zA-ZçğıİöşüÇĞIÖŞÜ]+|[^\sa-zA-ZçğıİöşüÇĞIÖŞÜ]+)/).filter(Boolean);
    const tokens = [];

    for (const part of parts) {
      const w = part.trim();
      if (!w) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      const entry = isPunctuation ? null : this.lookupOffline(w, nativeLang);

      tokens.push({
        text: w,
        word: w,
        targetLang: 'tr',
        nativeLang: nativeLang || 'es',
        auxiliary: null,
        pinyin: null,
        translit: null,
        gloss: isPunctuation ? null : (entry?.gloss || null),
        glossSource: isPunctuation ? undefined : ((isSpanishNative && entry?.gloss) ? 'offline' : null),
        isPunctuation
      });
    }
    return tokens;
  }

  lookupOffline(word, nativeLang = 'es') {
    if (!word) return null;
    const isSpanishNative = (nativeLang || 'es').toLowerCase().split('-')[0] === 'es';
    if (!isSpanishNative) return null;
    const clean = word.trim().toLocaleLowerCase('tr-TR');
    if (this.offlineDict[clean]) return this.offlineDict[clean];

    // Strip proper noun apostrophe suffix e.g. "İstanbul'da" -> "İstanbul"
    if (clean.includes("'")) {
      const root = clean.split("'")[0];
      if (this.offlineDict[root]) return this.offlineDict[root];
    }

    return null;
  }

  isTokenComplete(token, nativeLang = 'es') {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss) return false;

    if (token.glossSource === 'manual' && gloss) return true;

    const targetNative = (nativeLang || 'es').toLowerCase().split('-')[0];
    const tokenNative = (token.nativeLang || '').toLowerCase().split('-')[0];
    const tokenTarget = (token.targetLang || '').toLowerCase().split('-')[0];

    if (tokenTarget && tokenTarget !== 'tr') return false;

    // Verified AI gloss: MUST match active targetLang ('tr') and requested nativeLang
    if (token.glossSource === 'ai') {
      if (tokenNative && tokenNative !== targetNative) return false;
      if (!tokenNative) return false;
      return true;
    }

    // Verified offline dictionary gloss: strictly valid ONLY when nativeLang === 'es'
    if (token.glossSource === 'offline') {
      if (targetNative !== 'es') return false;
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        return true;
      }
    }

    // Direct offline lookup fallback for nativeLang === 'es'
    if (targetNative === 'es') {
      const entry = this.lookupOffline(w, 'es');
      if (entry && entry.gloss) {
        return true;
      }
    }

    return false;
  }
}

export class DefaultGlossStrategy {
  constructor(langCode = 'default') {
    this.code = langCode;
    this.name = langCode.toUpperCase();
    this.hasAuxiliary = false;
    this.hasTranslit = false; // Strictly NO transliteration or auxiliary for Russian, Bulgarian, Dutch, English, etc.
    this.requiresTranslit = false;
    this.translitKey = null;
    this.offlineDict = {};
  }

  tokenize(text, nativeLang = 'es') {
    if (!text || typeof text !== 'string') return [];
    const cleanStr = text.trim();
    if (!cleanStr) return [];

    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const locale = this.code && this.code !== 'default' ? this.code : undefined;
        const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
        const segments = [...segmenter.segment(cleanStr)];
        const tokens = [];
        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;
          const isPunctuation = !seg.isWordLike || PUNCTUATION_REGEX.test(w);
          tokens.push({
            text: w,
            word: w,
            targetLang: this.code,
            nativeLang: nativeLang || 'es',
            auxiliary: null,
            pinyin: null,
            translit: null,
            gloss: null,
            glossSource: null,
            isPunctuation
          });
        }
        if (tokens.length > 0) return tokens;
      }
    } catch (e) {
      console.warn(`Intl.Segmenter fallback in DefaultGlossStrategy for ${this.code}:`, e);
    }

    const parts = cleanStr.split(/(\s+|[.,!?;:'"()\-¿¡«»]+)/).filter(p => p && p.trim().length > 0);
    return parts.map(w => {
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      return {
        text: w,
        word: w,
        targetLang: this.code,
        nativeLang: nativeLang || 'es',
        auxiliary: null,
        pinyin: null,
        translit: null,
        gloss: null,
        glossSource: null,
        isPunctuation
      };
    });
  }

  lookupOffline() {
    return null;
  }

  isTokenComplete(token, nativeLang = 'es') {
    if (!token) return false;
    if (token.isPunctuation) return true;
    const w = (token.text || token.word || '').trim();
    if (!w || PUNCTUATION_REGEX.test(w)) return true;

    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss) return false;

    if (token.glossSource === 'manual' && gloss) return true;

    const targetNative = (nativeLang || 'es').toLowerCase().split('-')[0];
    const tokenNative = (token.nativeLang || '').toLowerCase().split('-')[0];
    const tokenTarget = (token.targetLang || '').toLowerCase().split('-')[0];
    const strategyTarget = (this.code || '').toLowerCase().split('-')[0];

    if (tokenTarget && tokenTarget !== strategyTarget) return false;

    // Verified AI gloss: MUST match active targetLang and requested nativeLang
    if (token.glossSource === 'ai') {
      if (tokenNative && tokenNative !== targetNative) return false;
      if (!tokenNative) return false;
      return true;
    }

    return false;
  }
}

// Strategy Singleton Instances
const strategyInstances = {
  zh: new ChineseGlossStrategy(),
  ar: new ArabicGlossStrategy(),
  pl: new PolishGlossStrategy(),
  tr: new TurkishGlossStrategy()
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
