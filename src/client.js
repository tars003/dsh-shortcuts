import { DEFAULTS, validateBindings, createShortcutHandler } from './shortcuts.js';
import { STORAGE_KEY, decodePreferences, loadPreferences, savePreferences } from './preferences.js';

export const inject = ['layout', 'sidebarRight'];

export function apply(ctx) {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');
  let storage;
  try { storage = window.localStorage; } catch { /* Defaults work without storage. */ }
  let bindings = loadPreferences(storage, isMac);
  const subscribers = new Set();
  const actions = {
    left: () => { ctx.layout.toggleSidebar(); },
    right: () => {
      try { ctx.sidebarRight.toggleExpanded(); }
      catch (error) {
        // DSH has no public mounted predicate. active() is also undefined for a
        // valid, fresh, empty sidebar, so it must NOT be used as an open guard.
        if (error?.message === 'sidebarRight: no session surface is mounted') return false;
        throw error;
      }
    },
  };
  let handler = createShortcutHandler(bindings, actions, isMac);
  const update = (next) => {
    bindings = next;
    handler = createShortcutHandler(next, actions, isMac);
    for (const notify of subscribers) notify();
  };
  ctx.effect(() => {
    const onKey = (event) => handler(event);
    const onStorage = (event) => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === storage) {
        update(decodePreferences(event.newValue, isMac));
      }
    };
    // Bubble phase respects editor/terminal handlers that already consumed a key.
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
    React.useEffect(() => {
      const sync = () => { setDraft({ ...bindings }); setFeedback(''); };
      subscribers.add(sync);
      return () => subscribers.delete(sync);
    }, []);
    const save = (values) => {
      try {
        const valid = validateBindings(values, isMac);
        // Persist first so we never show a false "saved" confirmation.
        const next = savePreferences(storage, valid, isMac);
        update(next);
        setFailed(false);
        setFeedback('Shortcuts saved for this browser.');
      } catch (error) {
        setFailed(true);
        setFeedback(storage ? error.message : 'Browser storage is unavailable. Default shortcuts remain active.');
      }
    };
    const h = React.createElement;
    return h('section', { className: 'dsh-shortcuts-settings', 'aria-labelledby': 'dsh-shortcuts-heading' },
      h('style', null, `
        .dsh-shortcuts-settings{color:var(--dsw-color-text-primary,inherit);font:inherit;max-width:42rem;padding:24px;box-sizing:border-box}
        .dsh-shortcuts-settings h2{font-size:20px;line-height:1.4;margin:0 0 8px;font-weight:600}
        .dsh-shortcuts-settings p{font-size:14px;line-height:1.6;margin:0 0 20px}
        .dsh-shortcuts-settings label{display:block;font-size:14px;font-weight:500;margin:0 0 8px}
        .dsh-shortcuts-settings input{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:10px 12px;width:100%;box-sizing:border-box;min-height:42px}
        .dsh-shortcuts-settings .dsh-shortcuts-field{margin:0 0 20px;max-width:30rem}
        .dsh-shortcuts-settings .dsh-shortcuts-actions{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
        .dsh-shortcuts-settings button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:8px 14px;min-height:40px;cursor:pointer}
        .dsh-shortcuts-settings button:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
        .dsh-shortcuts-settings :is(button,input):focus-visible{outline:2px solid currentColor;outline-offset:3px}
        @media(max-width:480px){.dsh-shortcuts-settings{padding:16px}}
      `),
      h('h2', { id: 'dsh-shortcuts-heading' }, 'Keyboard shortcuts'),
      h('p', null, 'Show or collapse either sidebar without leaving the keyboard.'),
      h('form', { onSubmit: (event) => { event.preventDefault(); save(draft); } },
        ...[['left', 'Toggle left sidebar'], ['right', 'Toggle right sidebar']].map(([side, label]) =>
          h('div', { key: side, className: 'dsh-shortcuts-field' },
            h('label', { htmlFor: `dsh-shortcuts-${side}` }, label),
            h('input', {
              id: `dsh-shortcuts-${side}`, type: 'text', value: draft[side],
              autoComplete: 'off', spellCheck: false, maxLength: 80,
              'aria-describedby': 'dsh-shortcuts-help',
              onKeyDown: (event) => {
                // Preserve the settings shell's ordinary Escape-to-close key.
                if (event.key !== 'Escape' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) event.stopPropagation();
              },
              onChange: (event) => { setDraft({ ...draft, [side]: event.target.value }); setFeedback(''); },
            }))),
        h('p', { id: 'dsh-shortcuts-help' },
          'Type a combination, for example Mod+B or Alt+Shift+R. Mod means Command on Mac and Ctrl on Windows/Linux. Leave a field empty to disable it.'),
        h('div', { className: 'dsh-shortcuts-actions' },
          h('button', { type: 'submit' }, 'Save shortcuts'),
          h('button', { type: 'button', onClick: () => save({ ...DEFAULTS }) }, 'Restore defaults')),
        h('p', { role: failed ? 'alert' : 'status', 'aria-live': 'polite' }, feedback)),
      h('p', null, 'Some browser or operating-system shortcuts cannot be overridden. If a combination conflicts, choose another. Editors and terminals keep combinations they already handle.'));
  }
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section', id: 'dsh-shortcuts', order: 30, label: 'Keyboard shortcuts',
  }, ShortcutSettings));
}
