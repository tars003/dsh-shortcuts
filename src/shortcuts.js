// Pure parsing/matching/recording logic, shared by the browser bundle and tests.
export const DEFAULTS = Object.freeze({ left: 'Mod+B', right: 'Mod+Shift+B', settings: 'Mod+Comma' });
export const ACTIONS = Object.freeze(['left', 'right', 'settings']);

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
  [',', 'Comma'], ['comma', 'Comma'],
]);

export function parseShortcut(text, isMac = false) {
  if (typeof text !== 'string') throw new Error('Choose a keyboard combination.');
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
  if (!key) throw new Error('Use a letter, digit, comma, F1–F24, Space, Enter, Escape or a navigation key.');
  if (!modifiers.has('mod') && !modifiers.has('ctrl') && !modifiers.has('meta') && !modifiers.has('alt')) {
    throw new Error('Include Ctrl, Command or Alt so ordinary typing is not intercepted.');
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
  const result = {};
  const signatures = new Set();
  for (const action of ACTIONS) {
    const parsed = parseShortcut(values[action] ?? (action === 'settings' ? DEFAULTS.settings : undefined), isMac);
    if (parsed && signatures.has(parsed.signature)) throw new Error('Choose a different combination for each action.');
    if (parsed) signatures.add(parsed.signature);
    result[action] = parsed?.text ?? '';
  }
  return result;
}

export function eventKey(event) {
  let key = event.key === ' ' ? 'Space' : event.key?.length === 1 ? event.key.toUpperCase() : event.key;
  // Recover letters/digits/comma when Shift or Option produces a symbol/dead key.
  if ((event.shiftKey || event.altKey) && !/^[A-Z0-9]$/.test(key ?? '')) {
    if (/^Key[A-Z]$/.test(event.code ?? '')) key = event.code.slice(3);
    else if (/^Digit[0-9]$/.test(event.code ?? '')) key = event.code.slice(5);
    else if (event.code === 'Comma') key = 'Comma';
  }
  return key === ',' ? 'Comma' : key;
}

export function recordShortcut(event, isMac = false) {
  if (event.repeat || event.isComposing || event.keyCode === 229 || event.getModifierState?.('AltGraph')) return null;
  if (['Control', 'Meta', 'Alt', 'Shift', 'AltGraph'].includes(event.key)) return null;
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('Ctrl');
  if (event.metaKey) modifiers.push('Cmd');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  return parseShortcut([...modifiers, eventKey(event)].join('+'), isMac).text;
}

export function displayShortcut(text, isMac = false) {
  if (!text) return 'Disabled';
  return text.split('+').map((part) => part === 'Mod' ? (isMac ? 'Cmd' : 'Ctrl') : part === 'Comma' ? ',' : part).join(' + ');
}

export function matchesShortcut(event, shortcut, allowRepeat = false) {
  if (!shortcut || (event.repeat && !allowRepeat) || event.isComposing || event.keyCode === 229
    || event.defaultPrevented || event.getModifierState?.('AltGraph')) return false;
  return eventKey(event) === shortcut.key && Boolean(event.ctrlKey) === shortcut.ctrl
    && Boolean(event.metaKey) === shortcut.meta && Boolean(event.altKey) === shortcut.alt
    && Boolean(event.shiftKey) === shortcut.shift;
}

// Return false for unavailable actions: do not swallow a browser shortcut then.
export function createShortcutHandler(bindings, actions, isMac = false) {
  const parsed = Object.fromEntries(ACTIONS.map((action) => [action, parseShortcut(bindings[action] ?? DEFAULTS[action], isMac)]));
  let lastHandled = null;
  return (event) => {
    for (const action of ACTIONS) {
      if (!matchesShortcut(event, parsed[action], true)) continue;
      const handled = event.repeat ? lastHandled === action : typeof actions[action] === 'function' && actions[action]() !== false;
      lastHandled = handled ? action : null;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (!event.repeat) lastHandled = null;
  };
}
