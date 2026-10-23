import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: new URL('../', import.meta.url) });
const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

function setup({ mac = false, storageBlocked = false, raw, noSlots = false } = {}) {
  let plugin; let renderer; let cursor = 0;
  const states = []; const effects = []; const pending = [];
  let left = 0; let right = 0; let settings = 0;
  const disposers = [];
  const doc = new EventTarget(); const win = new EventTarget();
  const data = new Map(); if (raw) data.set('dsh-shortcuts:v1', raw);
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  if (storageBlocked) Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked'); } });
  else win.localStorage = storage;
  let open = false;
  const trigger = { disabled: false, closest: () => null, getAttribute: () => String(open), click() { open = true; settings++; } };
  const anchor = { closest: () => trigger };
  const seat = { contains: () => true, querySelector: (selector) => selector.includes('settings.trigger') ? anchor : null };
  doc.querySelector = () => seat;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }),
    useState: (initial) => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useEffect: (fn, deps) => {
      const i = cursor++;
      const previous = effects[i];
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) pending.push(() => {
        previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() };
      });
    },
  };
  win.__ModuleLoader__ = { load(row) {
    assert.equal(row.id, 'dsh-shortcuts');
    plugin = row.factory((request) => { assert.equal(request, 'react'); return React; });
  } };
  vm.runInNewContext(source, { window: win, document: doc, navigator: { platform: mac ? 'MacIntel' : 'Linux' }, console });
  const ctx = {
    layout: { toggleSidebar() { left++; } }, sidebarRight: { toggleExpanded() { right++; } },
    effect: (setup) => { disposers.push(setup()); },
    get: (key) => key === 'slots' && !noSlots ? {
      inject(name, callback) { assert.equal(name, 'settings.section'); callback(); },
      register(options, component) { assert.equal(options.id, 'dsh-shortcuts'); renderer = component; },
    } : undefined,
  };
  plugin.apply(ctx);
  function fire(overrides = {}, target = doc, type = 'keydown') {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { key: 'b', code: 'KeyB', ctrlKey: !mac, metaKey: mac, altKey: false, shiftKey: false, ...overrides });
    target.dispatchEvent(event); return event;
  }
  function render() { cursor = 0; const tree = renderer(); pending.splice(0).forEach((effect) => effect()); return tree; }
  function all(node, type) { return [ ...(node?.type === type ? [node] : []), ...(node?.children ?? []).flatMap((child) => typeof child === 'object' && child ? all(child, type) : []) ]; }
  function button(tree, label) { return all(tree, 'button').find((node) => node.props['aria-label'] === label || node.children.includes(label)); }
  function record(action, overrides) {
    button(render(), `Record shortcut: ${action}`).props.onClick(); render();
    const event = fire(overrides, win);
    render(); fire(overrides, win, 'keyup'); render();
    return event;
  }
  return { plugin, ctx, fire, render, all, button, record, data, storage, win, doc,
    counts: () => [left, right, settings],
    dispose: () => { effects.forEach((effect) => effect?.cleanup?.()); disposers.forEach((dispose) => dispose()); },
  };
}

test('built client registers sidebar and Settings shortcuts on both platforms and cleans up', () => {
  for (const mac of [false, true]) {
    const app = setup({ mac });
    assert.equal(app.fire().defaultPrevented, true);
    assert.equal(app.fire({ shiftKey: true }).defaultPrevented, true);
    assert.equal(app.fire({ key: ',', code: 'Comma' }).defaultPrevented, true);
    app.fire({ key: ',', code: 'Comma' }); // Open, never toggle closed.
    assert.deepEqual(app.counts(), [1, 1, 1]);
    app.dispose(); assert.equal(app.fire().defaultPrevented, false);
  }
});

test('fresh empty right sidebar can open; missing seat and missing Settings trigger are ignored', () => {
  const app = setup(); app.ctx.sidebarRight.active = () => undefined;
  assert.equal(app.fire({ shiftKey: true }).defaultPrevented, true);
  app.ctx.sidebarRight.toggleExpanded = () => { throw new Error('sidebarRight: no session surface is mounted'); };
  assert.equal(app.fire({ shiftKey: true }).defaultPrevented, false);
  app.doc.querySelector = () => null;
  assert.equal(app.fire({ key: ',', code: 'Comma' }).defaultPrevented, false);
  app.dispose();
});

test('old preferences apply from startup and new preferences update across tabs', () => {
  const app = setup({ raw: JSON.stringify({ version: 1, left: 'Alt+L', right: '' }) });
  assert.equal(app.fire().defaultPrevented, false);
  assert.equal(app.fire({ key: 'l', ctrlKey: false, altKey: true }).defaultPrevented, true);
  const event = new Event('storage');
  Object.assign(event, { key: 'dsh-shortcuts:v1', storageArea: app.storage, newValue: JSON.stringify({ version: 1, left: 'Mod+X', right: '', settings: '' }) });
  app.win.dispatchEvent(event);
  assert.equal(app.fire({ key: 'x' }).defaultPrevented, true);
  assert.equal(app.fire({ key: ',', code: 'Comma' }).defaultPrevented, false);
  app.dispose();
});

test('press-to-record saves, validates conflicts, disables, and restores defaults', () => {
  const app = setup();
  assert.equal(app.record('Toggle left sidebar', { key: 'l', code: 'KeyL', ctrlKey: false, altKey: true }).defaultPrevented, true);
  app.all(app.render(), 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(app.fire().defaultPrevented, false);
  assert.equal(app.fire({ key: 'l', ctrlKey: false, altKey: true }).defaultPrevented, true);
  assert.equal(JSON.parse(app.data.get('dsh-shortcuts:v1')).left, 'Alt+L');
  app.record('Toggle right sidebar', { key: 'l', code: 'KeyL', ctrlKey: false, altKey: true });
  app.all(app.render(), 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.ok(app.all(app.render(), 'p').some((p) => p.props.role === 'alert'));
  app.button(app.render(), 'Disable shortcut: Open Settings').props.onClick();
  app.button(app.render(), 'Restore defaults').props.onClick();
  assert.equal(app.fire().defaultPrevented, true);
  assert.equal(JSON.parse(app.data.get('dsh-shortcuts:v1')).settings, 'Mod+Comma');
  app.dispose();
});

test('recording consumes Escape without saving it, allows Tab, rejects ordinary typing, and survives held keys', () => {
  const app = setup();
  const begin = () => { app.button(app.render(), 'Record shortcut: Toggle left sidebar').props.onClick(); app.render(); };
  begin();
  assert.equal(app.fire({ key: 'Escape', ctrlKey: false }, app.win).defaultPrevented, true); app.render();
  assert.equal(app.button(app.render(), 'Record shortcut: Toggle left sidebar').props['aria-pressed'], false);
  begin();
  assert.equal(app.fire({ key: 'Tab', ctrlKey: false }, app.win).defaultPrevented, false); app.render();
  begin();
  app.fire({ key: 'r', ctrlKey: false }, app.win); app.render();
  assert.ok(app.all(app.render(), 'p').some((p) => p.props.role === 'alert'));
  app.fire({}, app.win); app.render();
  assert.equal(app.fire({ repeat: true }, app.win).defaultPrevented, true);
  assert.equal(app.fire().defaultPrevented, false); // Global listener suspended.
  app.fire({}, app.win, 'keyup'); app.render();
  assert.equal(app.fire().defaultPrevented, true);
  app.dispose();
});

test('blocked storage uses defaults and disposal while recording removes capture', () => {
  const app = setup({ storageBlocked: true });
  assert.equal(app.fire().defaultPrevented, true);
  app.all(app.render(), 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.ok(app.all(app.render(), 'p').some((p) => p.props.role === 'alert'));
  app.button(app.render(), 'Record shortcut: Open Settings').props.onClick(); app.render(); app.dispose();
  assert.equal(app.fire({}, app.win).defaultPrevented, false);
  const headless = setup({ noSlots: true });
  assert.equal(headless.fire().defaultPrevented, true); headless.dispose();
});
