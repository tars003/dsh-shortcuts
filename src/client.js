import { DEFAULTS, ACTIONS, validateBindings, createShortcutHandler, recordShortcut, displayShortcut } from './shortcuts.js';
import { STORAGE_KEY, decodePreferences, loadPreferences, savePreferences } from './preferences.js';
import { openSettings } from './settings.js';

export const inject = ['layout', 'sidebarRight'];

export function apply(ctx) {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');
  let storage;
  try { storage = window.localStorage; } catch { /* Defaults work without storage. */ }
  let bindings = loadPreferences(storage, isMac);
  const subscribers = new Set();
  let recordingActive = false;
  const actions = {
    left: () => { ctx.layout.toggleSidebar(); },
    right: () => {
      try { ctx.sidebarRight.toggleExpanded(); }
      catch (error) {
        if (error?.message === 'sidebarRight: no session surface is mounted') return false;
        throw error;
      }
    },
    settings: () => openSettings(document),
  };
  let handler = createShortcutHandler(bindings, actions, isMac);
  const update = (next) => {
    bindings = next;
    handler = createShortcutHandler(next, actions, isMac);
    for (const notify of subscribers) notify();
  };
  ctx.effect(() => {
    const onKey = (event) => { if (!recordingActive) handler(event); };
    const onStorage = (event) => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === storage) update(decodePreferences(event.newValue, isMac));
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('storage', onStorage);
      subscribers.clear();
    };
  });

  const slots = ctx.get('slots');
  if (!slots) return;
  function ShortcutSettings() {
    const [draft, setDraft] = React.useState(() => ({ ...bindings }));
    const [feedback, setFeedback] = React.useState('');
    const [failed, setFailed] = React.useState(false);
    const [recording, setRecording] = React.useState(null);
    React.useEffect(() => {
      const sync = () => { setDraft({ ...bindings }); setRecording(null); setFeedback(''); };
      subscribers.add(sync);
      return () => subscribers.delete(sync);
    }, []);
    React.useEffect(() => {
      if (!recording) return;
      let captured = null;
      recordingActive = true;
      const consume = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      const onKey = (event) => {
        if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
          setRecording(null); // Preserve keyboard navigation (including Shift+Tab).
          return;
        }
        consume(event); // Before shell Escape handlers and existing shortcuts.
        if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
          setRecording(null); setFeedback('Recording cancelled.'); return;
        }
        if (captured) return;
        try {
          const next = recordShortcut(event, isMac);
          if (!next) return;
          captured = event.code || event.key;
          setDraft((previous) => ({ ...previous, [recording]: next }));
          setFailed(false);
          setFeedback('Combination recorded. Select Save shortcuts to apply.');
        } catch (error) { setFailed(true); setFeedback(error.message); }
      };
      const onUp = (event) => {
        // Keep capture active until the recorded key is released: held repeats
        // must not activate an old binding after the first captured keydown.
        if (captured) {
          consume(event);
          if ((event.code || event.key) === captured) setRecording(null);
        }
      };
      const cancel = () => setRecording(null);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keyup', onUp, true);
      window.addEventListener('blur', cancel);
      return () => {
        recordingActive = false;
        window.removeEventListener('keydown', onKey, { capture: true });
        window.removeEventListener('keyup', onUp, { capture: true });
        window.removeEventListener('blur', cancel);
      };
    }, [recording]);
    const save = (values) => {
      setRecording(null);
      try {
        const valid = validateBindings(values, isMac);
        const next = savePreferences(storage, valid, isMac);
        update(next);
        setFailed(false);
        setFeedback('Shortcuts saved for this browser.');
      } catch (error) {
        setFailed(true);
        setFeedback(storage ? error.message : 'Browser storage is unavailable. Saved shortcuts remain unchanged.');
      }
    };
    const h = React.createElement;
    const labels = { left: 'Toggle left sidebar', right: 'Toggle right sidebar', settings: 'Open Settings' };
    return h('section', { className: 'dsh-shortcuts-settings', 'aria-labelledby': 'dsh-shortcuts-heading' },
      h('style', null, `
        .dsh-shortcuts-settings{color:var(--dsw-color-text-primary,inherit);font:inherit;max-width:42rem;padding:24px;box-sizing:border-box}
        .dsh-shortcuts-settings h2{font-size:20px;line-height:1.4;margin:0 0 8px;font-weight:600}
        .dsh-shortcuts-settings p{font-size:14px;line-height:1.6;margin:0 0 20px}
        .dsh-shortcuts-settings .dsh-shortcuts-label{display:block;font-size:14px;font-weight:500;margin:0 0 8px}
        .dsh-shortcuts-settings .dsh-shortcuts-field{margin:0 0 20px;max-width:32rem}
        .dsh-shortcuts-settings .dsh-shortcuts-row{display:flex;gap:10px;align-items:stretch}
        .dsh-shortcuts-settings .dsh-shortcuts-recorder{flex:1;min-width:0;text-align:left;overflow-wrap:anywhere}
        .dsh-shortcuts-settings .dsh-shortcuts-recorder[aria-pressed=true]{outline:2px solid currentColor;outline-offset:2px;background:color-mix(in srgb,currentColor 8%,transparent)}
        .dsh-shortcuts-settings .dsh-shortcuts-actions{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
        .dsh-shortcuts-settings button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:8px 14px;min-height:42px;cursor:pointer}
        .dsh-shortcuts-settings button:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
        .dsh-shortcuts-settings button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
        @media(max-width:480px){.dsh-shortcuts-settings{padding:16px}}
      `),
      h('h2', { id: 'dsh-shortcuts-heading' }, 'Keyboard shortcuts'),
      h('p', { id: 'dsh-shortcuts-help' }, 'Select a shortcut below, then press your new key combination. Include Ctrl, Command or Alt. Escape cancels; Tab moves to the next control.'),
      h('form', { onSubmit: (event) => { event.preventDefault(); save(draft); } },
        ...ACTIONS.map((action) => h('div', { key: action, className: 'dsh-shortcuts-field' },
          h('span', { id: `dsh-shortcuts-${action}-label`, className: 'dsh-shortcuts-label' }, labels[action]),
          h('div', { className: 'dsh-shortcuts-row' },
            h('button', {
              type: 'button', className: 'dsh-shortcuts-recorder',
              'aria-label': `Record shortcut: ${labels[action]}`,
              'aria-describedby': 'dsh-shortcuts-help', 'aria-pressed': recording === action,
              onClick: () => { setRecording(recording === action ? null : action); setFeedback(''); setFailed(false); },
              onBlur: () => setRecording((current) => current === action ? null : current),
            }, recording === action ? 'Press keys…' : displayShortcut(draft[action], isMac)),
            h('button', {
              type: 'button', 'aria-label': `Disable shortcut: ${labels[action]}`,
              onClick: () => { setRecording(null); setDraft((previous) => ({ ...previous, [action]: '' })); setFeedback('Select Save shortcuts to apply.'); setFailed(false); },
            }, 'Disable')))),
        h('div', { className: 'dsh-shortcuts-actions' },
          h('button', { type: 'submit' }, 'Save shortcuts'),
          h('button', { type: 'button', onClick: () => save({ ...DEFAULTS }) }, 'Restore defaults')),
        h('p', { role: failed ? 'alert' : 'status', 'aria-live': 'polite' }, recording && !feedback ? 'Listening for your key combination…' : feedback)),
      h('p', null, 'Changes are saved only in this browser. Some browser or operating-system shortcuts cannot be overridden. Editors and terminals keep combinations they already handle.'));
  }
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section', id: 'dsh-shortcuts', order: 30, label: 'Keyboard shortcuts',
  }, ShortcutSettings));
}
