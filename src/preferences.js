import { DEFAULTS, validateBindings } from './shortcuts.js';

export const STORAGE_KEY = 'dsh-shortcuts:v1';

// Only plugin-owned JSON is serialized. No DSH runtime objects enter storage.
export function decodePreferences(raw, isMac = false) {
  if (!raw) return { ...DEFAULTS };
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1) return { ...DEFAULTS };
    const previous = { left: value.left, right: value.right };
    if (Object.hasOwn(value, 'settings')) return validateBindings({ ...previous, settings: value.settings }, isMac);
    // v0.1.0 records had only sidebars. Keep them intact; if a user already
    // assigned Mod+Comma to a sidebar, leave the new Settings action disabled.
    try { return validateBindings({ ...previous, settings: DEFAULTS.settings }, isMac); }
    catch { return validateBindings({ ...previous, settings: '' }, isMac); }
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
