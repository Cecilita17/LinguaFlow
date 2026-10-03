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
    { id: 'sans', label: 'font_style_modern', family: 'Noto Sans SC' },
    { id: 'serif', label: 'font_style_book', family: 'Noto Serif SC', load: true }
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
    script, options.some(option => option.id === value?.[script]) ? value[script] : DEFAULT_FONT_PREFERENCES[script]
  ]));
}

export function getFontConfiguration(preferences) {
  const normalized = normalizeFontPreferences(preferences);
  const selected = Object.entries(FONT_OPTIONS).map(([script, options]) => options.find(option => option.id === normalized[script]));
  // Latin, Chinese and Arabic glyphs each resolve to their selected family.
  const family = selected.map(option => option.family === 'system-ui' ? 'system-ui' : `'${option.family}'`).join(', ') + ', -apple-system, sans-serif';
  const extraFamilies = selected.filter(option => option.load).map(option => `family=${encodeURIComponent(option.family).replaceAll('%20', '+')}:wght@400;500;600;700`);
  return { family, stylesheet: extraFamilies.length ? `https://fonts.googleapis.com/css2?${extraFamilies.join('&')}&display=swap` : null };
}
