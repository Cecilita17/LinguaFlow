export const FONT_PREFERENCES_KEY = 'linguaflow_font_preferences';
export const FONT_OPTIONS = {
  general: [
    { id: 'sans', name: 'Inter', family: 'Inter' },
    { id: 'open-sans', name: 'Open Sans', family: 'Open Sans', load: true },
    { id: 'roboto', name: 'Roboto', family: 'Roboto', load: true },
    { id: 'noto-sans', name: 'Noto Sans', family: 'Noto Sans', load: true },
    { id: 'liberation-serif', name: 'Liberation Serif', family: 'Liberation Serif' },
    { id: 'serif', name: 'Lora', family: 'Lora', load: true },
    { id: 'merriweather', name: 'Merriweather', family: 'Merriweather', load: true },
    { id: 'poppins', name: 'Poppins', family: 'Poppins', load: true },
    { id: 'rounded', name: 'Nunito', family: 'Nunito', load: true }
  ],
  chinese: [
    { id: 'sans', name: 'Noto Sans SC', family: 'Noto Sans SC' },
    { id: 'noto-cjk', name: 'Noto Sans CJK (SC)', family: 'Noto Sans SC' },
    { id: 'serif', name: 'Noto Serif SC', family: 'Noto Serif SC', load: true },
    { id: 'kaishu', name: 'Kaishu (WenKai)', family: 'LXGW WenKai TC', weights: '400', load: true }
  ],
  arabic: [
    { id: 'system', label: 'font_style_current', family: 'system-ui' },
    { id: 'sans', label: 'font_style_modern', family: 'Noto Sans Arabic', load: true },
    { id: 'traditional', label: 'font_style_traditional', family: 'Amiri' }
  ]
};
export const DEFAULT_FONT_PREFERENCES = { general: 'sans', chinese: 'sans', arabic: 'system' };

export function normalizeFontPreferences(value) {
  return Object.fromEntries(Object.entries(FONT_OPTIONS).map(([script, options]) => [
    script, (() => {
      const legacyChinese = { yahei: 'sans', pingfang: 'sans', simsun: 'serif' };
      const id = script === 'chinese' ? (legacyChinese[value?.[script]] || value?.[script]) : value?.[script];
      return options.some(option => option.id === id) ? id : DEFAULT_FONT_PREFERENCES[script];
    })()
  ]));
}

export function getFontConfiguration(preferences) {
  const normalized = normalizeFontPreferences(preferences);
  const selected = Object.entries(FONT_OPTIONS).map(([script, options]) => options.find(option => option.id === normalized[script]));
  // Latin, Chinese and Arabic glyphs each resolve to their selected family.
  const family = selected.flatMap(option => [option.family, ...(option.fallbackFamilies || [])]).map(name => name === 'system-ui' ? 'system-ui' : `'${name}'`).join(', ') + ', -apple-system, sans-serif';
  const additionalFamilies = new Set(selected.flatMap(option => [...(option.load ? [option.family] : []), ...(option.fallbackLoad ? [option.fallbackLoad] : [])]));
  const extraFamilies = [...additionalFamilies].map(name => {
    const option = selected.find(item => item.family === name || item.fallbackLoad === name);
    const weights = option?.weights || '400;500;600;700';
    return `family=${encodeURIComponent(name).replaceAll('%20', '+')}:wght@${weights}`;
  });
  return { family, stylesheet: extraFamilies.length ? `https://fonts.googleapis.com/css2?${extraFamilies.join('&')}&display=swap` : null };
}
