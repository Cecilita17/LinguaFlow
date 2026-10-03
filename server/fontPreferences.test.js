import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FONT_PREFERENCES, FONT_OPTIONS, getFontConfiguration, normalizeFontPreferences } from '../src/utils/fontPreferences.js';

test('absent and malformed saved settings preserve usable defaults', () => {
  for (const value of [null, undefined, {}, 'invalid', [], { general: 'unknown', chinese: 'unknown', arabic: 'unknown' }]) {
    assert.deepEqual(normalizeFontPreferences(value), DEFAULT_FONT_PREFERENCES);
  }
});
test('Chinese and Arabic styles persist independently of the general font', () => {
  const saved = JSON.parse(JSON.stringify({ general: 'rounded', chinese: 'serif', arabic: 'traditional' }));
  const preferences = normalizeFontPreferences(saved);
  assert.deepEqual(preferences, saved);
  const config = getFontConfiguration(preferences);
  assert.ok(config.family.includes("'Nunito'"));
  assert.ok(config.family.includes("'Noto Serif SC'"));
  assert.ok(config.family.includes("'Amiri'"));
});
test('default fonts reuse existing font resources and include system fallback', () => {
  const config = getFontConfiguration(DEFAULT_FONT_PREFERENCES);
  assert.equal(config.stylesheet, null);
  assert.ok(config.family.includes('system-ui'));
  assert.ok(config.family.endsWith('sans-serif'));
});
test('only selected additional families load and invalid values cannot inject CSS', () => {
  const config = getFontConfiguration({ general: 'serif', chinese: 'sans', arabic: 'sans' });
  assert.ok(config.stylesheet.includes('family=Lora:'));
  assert.ok(config.stylesheet.includes('family=Noto+Sans+Arabic:'));
  assert.ok(!config.stylesheet.includes('Noto+Serif+SC'));
  assert.deepEqual(getFontConfiguration({ general: "');color:red;/*" }), getFontConfiguration(DEFAULT_FONT_PREFERENCES));
});
test('every combination supplies all script families with a safe fallback', () => {
  for (const general of FONT_OPTIONS.general) for (const chinese of FONT_OPTIONS.chinese) for (const arabic of FONT_OPTIONS.arabic) {
    const config = getFontConfiguration({ general: general.id, chinese: chinese.id, arabic: arabic.id });
    for (const option of [general, chinese, arabic]) assert.ok(config.family.includes(option.family));
    assert.ok(config.family.endsWith('sans-serif'));
  }
});

test('requested general fonts are selectable and Liberation Serif does not depend on Google Fonts', () => {
  const requested = ['Inter', 'Open Sans', 'Roboto', 'Noto Sans', 'Liberation Serif', 'Lora', 'Merriweather', 'Poppins'];
  for (const family of requested) assert.ok(FONT_OPTIONS.general.some(option => option.name === family));
  const config = getFontConfiguration({ general: 'liberation-serif' });
  assert.ok(config.family.startsWith("'Liberation Serif'"));
  assert.equal(config.stylesheet, null);
  assert.equal(normalizeFontPreferences({ general: 'rounded' }).general, 'rounded');
  assert.equal(normalizeFontPreferences({ general: 'serif' }).general, 'serif');
});

test('licensed Chinese choices migrate to free equivalents without affecting other scripts', () => {
  assert.deepEqual([...new Set(FONT_OPTIONS.chinese.map(option => option.family))], ['Noto Sans SC', 'Noto Serif SC', 'LXGW WenKai TC']);
  for (const [old, replacement] of Object.entries({ yahei: 'sans', pingfang: 'sans', 'noto-cjk': 'noto-cjk', simsun: 'serif' })) {
    const preferences = normalizeFontPreferences({ general: 'poppins', chinese: old, arabic: 'traditional' });
    assert.equal(preferences.chinese, replacement);
    assert.equal(preferences.general, 'poppins');
    assert.equal(preferences.arabic, 'traditional');
  }
});

test('Kaishu persists and loads a compatible calligraphic font on other devices', () => {
  const preferences = normalizeFontPreferences(JSON.parse(JSON.stringify({ chinese: 'kaishu' })));
  assert.equal(preferences.chinese, 'kaishu');
  const config = getFontConfiguration(preferences);
  assert.ok(!config.family.includes("'KaiTi'"));
  assert.ok(config.family.includes("'LXGW WenKai TC'"));
  assert.ok(config.stylesheet.includes('family=LXGW+WenKai+TC:wght@400&'));
  assert.ok(!config.stylesheet.includes('family=KaiTi'));
});
