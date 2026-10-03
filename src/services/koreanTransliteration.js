import { romanize } from 'es-hangul';

// Revised Romanization, computed locally from Hangul with pronunciation rules.
export function getKoreanTransliteration(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const normalized = text.normalize('NFC');
  if (!/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(normalized)) return null;
  return romanize(normalized).trim() || null;
}
