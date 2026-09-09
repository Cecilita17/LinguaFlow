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
    { regex: /\bik\s+gaan\b/gi, replacement: 'ik ga' }
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
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

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
export async function performFullGrammarCorrection(text, targetLang = 'pl') {
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

  // 1. Check Spanish/English cross-corrections if user wrote in native language
  const crossRules = SPANISH_CROSS_CORRECTIONS[targetLang] || [];
  for (const rule of crossRules) {
    if (rule.regex.test(corrected)) {
      corrected = corrected.replace(rule.regex, rule.replacement);
      hasErrors = true;
    }
  }

  // 2. Check Deep Grammatical Rules (conjugation, case, diacritics, idioms)
  const rules = DEEP_LANGUAGE_RULES[targetLang] || [];
  for (const rule of rules) {
    if (rule.regex.test(corrected)) {
      corrected = corrected.replace(rule.regex, rule.replacement);
      hasErrors = true;
    }
  }

  // 3. Asynchronously call LanguageTool for typo/spelling/advanced grammar
  try {
    const ltResult = await checkLanguageTool(corrected, targetLang);
    if (ltResult && ltResult !== corrected) {
      corrected = ltResult;
      hasErrors = true;
    }
  } catch (e) {}

  // 4. If corrected differs from original, errors occurred
  if (corrected.toLowerCase().trim() !== original.toLowerCase().trim()) {
    hasErrors = true;
  }

  // 5. Compute fine-grained diff tokens with golden highlighting
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
export async function reanalyzeGrammarStrictly(text, targetLang = 'pl') {
  return performFullGrammarCorrection(text, targetLang);
}
