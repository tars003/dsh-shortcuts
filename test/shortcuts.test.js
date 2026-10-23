import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, parseShortcut, validateBindings, matchesShortcut, createShortcutHandler } from '../src/shortcuts.js';
import { decodePreferences, loadPreferences, savePreferences, STORAGE_KEY } from '../src/preferences.js';

function key(overrides = {}) {
  return { key: 'b', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false,
    prevented: false, stopped: false, preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; }, ...overrides };
}

test('Mod follows platform; explicit Ctrl and Cmd do not', () => {
  assert.equal(parseShortcut('Mod+B').ctrl, true);
  assert.equal(parseShortcut('Mod+B', true).meta, true);
  assert.equal(parseShortcut('Control+B', true).ctrl, true);
  assert.equal(parseShortcut('Command+B').meta, true);
});

test('normalizes case, whitespace, modifier order and aliases', () => {
  assert.equal(parseShortcut(' shift + option + r ').text, 'Alt+Shift+R');
  assert.equal(parseShortcut('cmd+Esc').text, 'Cmd+Escape');
  assert.equal(parseShortcut('ctrl+F24').key, 'F24');
  assert.equal(parseShortcut('alt+ArrowLeft').key, 'ArrowLeft');
  assert.equal(parseShortcut('   '), null);
});

test('rejects unsafe or malformed bindings', () => {
  for (const value of ['B', 'Shift+B', 'Ctrl+', 'Ctrl++', 'Ctrl+Ctrl+B', 'Mod+Ctrl+B', 'Mod+Cmd+B', 'Hyper+B', 'Ctrl+Foo', 'Ctrl+F25', 'Ctrl+Tab', null, 7]) {
    assert.throws(() => parseShortcut(value), undefined, String(value));
  }
});

test('rejects equivalent duplicates after platform resolution', () => {
  assert.throws(() => validateBindings({ left: 'Mod+B', right: 'Ctrl+B' }));
  assert.throws(() => validateBindings({ left: 'Mod+B', right: 'Cmd+B' }, true));
  assert.deepEqual(validateBindings({ left: '', right: '' }), { left: '', right: '' });
  assert.deepEqual(validateBindings(DEFAULTS), DEFAULTS);
});

test('requires exact modifiers; ignores repeats, composition, AltGr and consumed events', () => {
  const shortcut = parseShortcut('Mod+B');
  assert.equal(matchesShortcut(key(), shortcut), true);
  assert.equal(matchesShortcut(key({ key: 'B' }), shortcut), true);
  for (const overrides of [{ shiftKey: true }, { altKey: true }, { metaKey: true }, { ctrlKey: false }, { key: 'r' }, { repeat: true }, { isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }, { getModifierState: () => true }]) {
    assert.equal(matchesShortcut(key(overrides), shortcut), false);
  }
  assert.equal(matchesShortcut(key(), null), false);
  assert.equal(matchesShortcut(key({ key: ' ', ctrlKey: true }), parseShortcut('Ctrl+Space')), true);
});

test('handles shifted digits and macOS Option symbols without overriding normal layout letters', () => {
  assert.equal(matchesShortcut(key({ key: '!', code: 'Digit1', shiftKey: true }), parseShortcut('Ctrl+Shift+1')), true);
  assert.equal(matchesShortcut(key({ key: '®', code: 'KeyR', ctrlKey: false, altKey: true }), parseShortcut('Alt+R', true)), true);
  assert.equal(matchesShortcut(key({ key: 'Dead', code: 'KeyE', ctrlKey: false, altKey: true }), parseShortcut('Alt+E', true)), true);
  assert.equal(matchesShortcut(key({ key: 'z', code: 'KeyY', altKey: true }), parseShortcut('Ctrl+Alt+Y')), false);
  assert.equal(matchesShortcut(key({ key: '!', code: 'Digit1', shiftKey: true, repeat: true }), parseShortcut('Ctrl+Shift+1')), false);
});

test('dispatches each side and consumes only a successfully handled event', () => {
  const calls = [];
  const handler = createShortcutHandler(DEFAULTS, { left: () => calls.push('left'), right: () => calls.push('right') });
  const left = key(); handler(left);
  const right = key({ shiftKey: true }); handler(right);
  assert.deepEqual(calls, ['left', 'right']);
  assert.equal(left.prevented && left.stopped && right.prevented && right.stopped, true);
  const absent = key({ shiftKey: true });
  createShortcutHandler(DEFAULTS, { right: () => false })(absent);
  assert.equal(absent.prevented, false);
  const held = key({ shiftKey: true, repeat: true }); handler(held);
  assert.equal(held.prevented, true);
  assert.deepEqual(calls, ['left', 'right']);
  const absentRepeat = key({ shiftKey: true, repeat: true });
  createShortcutHandler(DEFAULTS, { right: () => false })(absentRepeat);
  assert.equal(absentRepeat.prevented, false);
  const unrelated = key({ key: 'x' }); handler(unrelated);
  assert.equal(unrelated.prevented, false);
});

test('storage round-trip and canonical values', () => {
  const map = new Map();
  const storage = { getItem: (key) => map.get(key), setItem: (key, value) => map.set(key, value) };
  assert.deepEqual(loadPreferences(storage), DEFAULTS);
  const expected = { left: 'Alt+L', right: '' };
  assert.deepEqual(savePreferences(storage, { left: 'alt+l', right: '' }), expected);
  assert.equal(JSON.parse(map.get(STORAGE_KEY)).version, 1);
  assert.deepEqual(loadPreferences(storage), expected);
});

test('storage failures or corrupted/unknown records fall back without throwing', () => {
  for (const raw of [null, '{oops', 'null', '[]', '{"version":2}', '{"version":1,"left":7,"right":null}', '{"version":1,"left":"Ctrl+B","right":"Mod+B"}']) {
    assert.deepEqual(decodePreferences(raw), DEFAULTS);
  }
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadPreferences(storage), DEFAULTS);
  assert.deepEqual(loadPreferences(undefined), DEFAULTS);
  assert.throws(() => savePreferences(storage, DEFAULTS), /blocked/);
});
