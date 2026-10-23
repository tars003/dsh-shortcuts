import { DEFAULTS, validateBindings } from './shortcuts.js';

export const STORAGE_KEY = 'dsh-shortcuts:v1';

// Only plugin-owned JSON is serialized. No DSH runtime objects enter storage.
export function decodePreferences(raw, isMac = false) {
  if (!raw) return { ...DEFAULTS };
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1) return { ...DEFAULTS };
    return validateBindings({ left: value.left, right: value.right }, isMac);
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadPreferences(storage, isMac = false) {
  try { return decodePreferences(storage.getItem(STORAGE_KEY), isMac); }
  catch { return { ...DEFAULTS }; }
}

export function savePreferences(storage, values, isMac = false) {
  const bindings = validateBindings(values, isMac);
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...bindings }));
  return bindings;
}
