// Pure parsing/matching logic, shared by the browser bundle and Node tests.
export const DEFAULTS = Object.freeze({ left: 'Mod+B', right: 'Mod+Shift+B' });

const MODIFIERS = new Map([
  ['mod', 'mod'], ['ctrl', 'ctrl'], ['control', 'ctrl'],
  ['cmd', 'meta'], ['command', 'meta'], ['meta', 'meta'],
  ['alt', 'alt'], ['option', 'alt'], ['shift', 'shift'],
]);
const NAMED_KEYS = new Map([
  ['space', 'Space'], ['enter', 'Enter'], ['escape', 'Escape'], ['esc', 'Escape'],
  ['arrowleft', 'ArrowLeft'], ['arrowright', 'ArrowRight'],
  ['arrowup', 'ArrowUp'], ['arrowdown', 'ArrowDown'],
  ['home', 'Home'], ['end', 'End'], ['pageup', 'PageUp'], ['pagedown', 'PageDown'],
]);

export function parseShortcut(text, isMac = false) {
  if (typeof text !== 'string') throw new Error('Enter a keyboard combination.');
  if (!text.trim()) return null;
  const parts = text.split('+').map((part) => part.trim().toLowerCase());
  const keyToken = parts.pop();
  const modifiers = new Set();
  for (const part of parts) {
    const modifier = MODIFIERS.get(part);
    if (!modifier || modifiers.has(modifier)) throw new Error('Use modifiers such as Mod, Ctrl, Cmd, Alt or Shift, followed by one key.');
    modifiers.add(modifier);
  }
  if (modifiers.has('mod') && (modifiers.has('ctrl') || modifiers.has('meta'))) {
    throw new Error('Use Mod on its own, or specify Ctrl / Cmd explicitly.');
  }
  const key = /^[a-z0-9]$/.test(keyToken) ? keyToken.toUpperCase()
    : /^f([1-9]|1[0-9]|2[0-4])$/.test(keyToken) ? keyToken.toUpperCase()
      : NAMED_KEYS.get(keyToken);
  if (!key) throw new Error('Use a letter, digit, F1–F24, Space, Enter, Escape or a navigation key.');
  if (!modifiers.has('mod') && !modifiers.has('ctrl') && !modifiers.has('meta') && !modifiers.has('alt')) {
    throw new Error('Include Mod, Ctrl, Cmd or Alt so typing is not intercepted.');
  }
  const ctrl = modifiers.has('ctrl') || (modifiers.has('mod') && !isMac);
  const meta = modifiers.has('meta') || (modifiers.has('mod') && isMac);
  const alt = modifiers.has('alt');
  const shift = modifiers.has('shift');
  const displayModifiers = ['mod', 'ctrl', 'meta', 'alt', 'shift']
    .filter((modifier) => modifiers.has(modifier))
    .map((modifier) => ({ mod: 'Mod', ctrl: 'Ctrl', meta: 'Cmd', alt: 'Alt', shift: 'Shift' })[modifier]);
  return { key, ctrl, meta, alt, shift,
    text: [...displayModifiers, key].join('+'),
    signature: [ctrl, meta, alt, shift, key].join(':') };
}

export function validateBindings(values, isMac = false) {
  const left = parseShortcut(values.left, isMac);
  const right = parseShortcut(values.right, isMac);
  if (left && right && left.signature === right.signature) throw new Error('Choose a different combination for each sidebar.');
  return { left: left?.text ?? '', right: right?.text ?? '' };
}

export function matchesShortcut(event, shortcut, allowRepeat = false) {
  if (!shortcut || (event.repeat && !allowRepeat) || event.isComposing || event.keyCode === 229
    || event.defaultPrevented || event.getModifierState?.('AltGraph')) return false;
  const key = event.key === ' ' ? 'Space' : event.key?.length === 1 ? event.key.toUpperCase() : event.key;
  // Shift+digits and macOS Option can replace the logical key with a symbol
  // (e.g. ! or ®). Recover the physical ASCII key only for those transforms;
  // ordinary alphabetic layout mappings still use the logical key.
  const transformed = (shortcut.shift || shortcut.alt) && !/^[A-Z0-9]$/.test(key ?? '');
  const physical = /^[A-Z]$/.test(shortcut.key) ? `Key${shortcut.key}`
    : /^[0-9]$/.test(shortcut.key) ? `Digit${shortcut.key}` : null;
  const keyMatches = key === shortcut.key || (transformed && physical !== null && event.code === physical);
  return keyMatches && Boolean(event.ctrlKey) === shortcut.ctrl
    && Boolean(event.metaKey) === shortcut.meta && Boolean(event.altKey) === shortcut.alt
    && Boolean(event.shiftKey) === shortcut.shift;
}

// Return false for unavailable actions: do not swallow a browser shortcut then.
export function createShortcutHandler(bindings, actions, isMac = false) {
  const parsed = {
    left: parseShortcut(bindings.left, isMac),
    right: parseShortcut(bindings.right, isMac),
  };
  let lastHandled = null;
  return (event) => {
    for (const side of ['left', 'right']) {
      if (!matchesShortcut(event, parsed[side], true)) continue;
      // A held shortcut should not retrigger the toggle OR leak its repeated
      // browser default (e.g. the bookmarks bar). Only consume repeats of an
      // initial press that this handler successfully handled.
      const handled = event.repeat ? lastHandled === side : actions[side]() !== false;
      lastHandled = handled ? side : null;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (!event.repeat) lastHandled = null;
  };
}
