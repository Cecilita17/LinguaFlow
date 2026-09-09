/**
 * Sentence Grammar Breakdown Engine
 * Provides word-by-word morphosyntactic grammatical analysis:
 * - Part of speech (Verb, Noun, Question Word, Adjective, Preposition, etc.)
 * - Verb conjugation details (Person, Number, Tense, Mood, Lemma / Infinitive)
 * - Noun/Adjective gender, number, and case
 * - Meaning in student's native language
 * - Correction flag highlighting modified words
 *
 * Example (Dutch):
 * "hoe: how question word. gaat: goes 3rd person singular present tense of gaan, to go."
 */

// Multilingual lexicon database for high-frequency linguistic items
const COMMON_WORDS_DB = {
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
  }
};

/**
 * Clean a word token removing outer punctuation marks
 */
function cleanToken(word) {
  return (word || '')
    .toLowerCase()
    .replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');
}

/**
 * Infer morphological and grammatical features for words not in the static dictionary
 */
function inferLinguisticRole(cleanWord, rawWord, targetLang) {
  if (!cleanWord) {
    return {
      pos: 'Puntuación o símbolo',
      lemma: rawWord,
      meaning: rawWord,
      explanation: 'Signo ortográfico auxiliar.'
    };
  }

  // Capitalized German noun rule
  if (targetLang === 'de' && /^[A-ZÄÖÜ]/.test(rawWord)) {
    return {
      pos: 'Sustantivo (Noun)',
      lemma: cleanWord,
      meaning: cleanWord,
      explanation: 'Sustantivo alemán con mayúscula inicial preceptiva.'
    };
  }

  // Spanish verb endings
  if (targetLang === 'es') {
    if (/ar$|er$|ir$/.test(cleanWord)) {
      return { pos: 'Verbo en infinitivo', lemma: cleanWord, meaning: `acción de ${cleanWord}`, explanation: 'Forma no conjugada del verbo (infinitivo).' };
    }
    if (/ando$|iendo$/.test(cleanWord)) {
      return { pos: 'Gerundio continuo', lemma: cleanWord, meaning: `haciendo ${cleanWord}`, explanation: 'Acción en desarrollo continuo.' };
    }
    if (/ó$|é$|í$|aste$|iste$/.test(cleanWord)) {
      return { pos: 'Verbo en pretérito perfecto simple', lemma: cleanWord, meaning: 'pasado', explanation: 'Acción completada en el pasado.' };
    }
    if (/ción$|sión$|dad$|tad$|ura$|eza$/.test(cleanWord)) {
      return { pos: 'Sustantivo femenino', lemma: cleanWord, meaning: cleanWord, explanation: 'Sustantivo derivado abstracto.' };
    }
  }

  // English verb endings
  if (targetLang === 'en') {
    if (/ing$/.test(cleanWord)) {
      return { pos: 'Present participle / Gerund', lemma: cleanWord.replace(/ing$/, ''), meaning: cleanWord, explanation: 'Continuous progressive aspect or gerund noun.' };
    }
    if (/ed$/.test(cleanWord)) {
      return { pos: 'Past tense / Past participle', lemma: cleanWord.replace(/ed$/, ''), meaning: cleanWord, explanation: 'Regular simple past or passive participle.' };
    }
    if (/s$/.test(cleanWord) && cleanWord.length > 3) {
      return { pos: 'Plural noun or 3rd pers. verb', lemma: cleanWord.replace(/s$/, ''), meaning: cleanWord, explanation: 'Noun plural or 3rd person present verb inflection.' };
    }
    if (/ly$/.test(cleanWord)) {
      return { pos: 'Adverb of manner', lemma: cleanWord, meaning: `${cleanWord.replace(/ly$/, '')}mente`, explanation: 'Adverb modifying a verb, adjective, or clause.' };
    }
  }

  // Dutch verb endings
  if (targetLang === 'nl') {
    if (/en$/.test(cleanWord)) {
      return { pos: 'Werkwoord infinitief / meervoud', lemma: cleanWord, meaning: cleanWord, explanation: 'Infinitivo verbal o forma plural en presente.' };
    }
    if (/t$/.test(cleanWord)) {
      return { pos: 'Werkwoord persoonsvorm (2e/3e persoon)', lemma: cleanWord.slice(0, -1), meaning: cleanWord, explanation: '2.ª o 3.ª persona singular del presente en holandés.' };
    }
  }

  // Polish endings
  if (targetLang === 'pl') {
    if (/ć$|c$/.test(cleanWord)) {
      return { pos: 'Czasownik w bezokoliczniku (Infinitivo)', lemma: cleanWord, meaning: cleanWord, explanation: 'Forma de infinitivo del verbo polaco.' };
    }
    if (/łem$|łam$|ł$|ła$|li$/.test(cleanWord)) {
      return { pos: 'Czasownik w czasie przeszłym (Pasado)', lemma: cleanWord, meaning: cleanWord, explanation: 'Forma verbal en tiempo pasado con marca de género.' };
    }
    if (/ę$/.test(cleanWord)) {
      return { pos: '1.ª persona singular o acusativo femenino', lemma: cleanWord, meaning: cleanWord, explanation: 'Desinencia verbal de 1.ª persona singular ("ja") o acusativo femenino.' };
    }
  }

  // General fallback
  return {
    pos: 'Término léxico',
    lemma: cleanWord,
    meaning: cleanWord,
    explanation: `Palabra léxica en ${targetLang.toUpperCase()}.`
  };
}

/**
 * Generate full sentence grammatical breakdown
 * @param {string} correctedText - The grammatically corrected sentence
 * @param {string} originalText - The original sentence typed by the student
 * @param {string} targetLang - Target language code ('nl', 'pl', 'es', 'en', etc.)
 * @param {string} nativeLang - Native language code ('es', 'en', etc.)
 * @returns {Array} Array of detailed token analysis objects
 */
export function generateSentenceBreakdown(correctedText, originalText = '', targetLang = 'nl', nativeLang = 'es') {
  if (!correctedText) return [];

  const rawTokens = correctedText.trim().split(/\s+/).filter(Boolean);
  const origTokens = originalText.trim().split(/\s+/).filter(Boolean);
  const langDict = COMMON_WORDS_DB[targetLang] || {};

  return rawTokens.map((rawWord, idx) => {
    const clean = cleanToken(rawWord);
    const origWord = origTokens[idx] || null;
    const cleanOrig = cleanToken(origWord);
    const wasCorrected = Boolean(origWord && clean && cleanOrig && clean !== cleanOrig);

    // 1. Check specialized lexicon
    const dictEntry = langDict[clean];
    let pos = '';
    let lemma = clean;
    let explanation = '';
    let meaning = clean;

    if (dictEntry) {
      pos = dictEntry.pos;
      lemma = dictEntry.lemma || clean;
      meaning = dictEntry.meaning || clean;
      explanation = dictEntry.explanation || '';
    } else {
      // 2. Infer morphological role
      const inferred = inferLinguisticRole(clean, rawWord, targetLang);
      pos = inferred.pos;
      lemma = inferred.lemma;
      meaning = inferred.meaning;
      explanation = inferred.explanation;
    }

    return {
      index: idx + 1,
      word: rawWord,
      cleanWord: clean,
      lemma,
      pos,
      explanation,
      meaning,
      wasCorrected,
      originalWord: wasCorrected ? origWord : null
    };
  });
}
