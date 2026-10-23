import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Always test the actual generated browser artifact, not only source helpers.
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: new URL('../', import.meta.url) });
const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

function setup({ mac = false, storageBlocked = false, raw, noSlots = false } = {}) {
  let plugin;
  let renderer;
  let state = [];
  let cursor = 0;
  let left = 0; let right = 0;
  const disposers = [];
  const doc = new EventTarget(); const win = new EventTarget();
  const data = new Map(); if (raw) data.set('dsh-shortcuts:v1', raw);
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  if (storageBlocked) Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked'); } });
  else win.localStorage = storage;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }),
    useState: (initial) => {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (value) => { state[i] = value; }];
    },
    useEffect: () => {},
  };
  win.__ModuleLoader__ = { load(row) {
    assert.equal(row.id, 'dsh-shortcuts');
    plugin = row.factory((request) => { assert.equal(request, 'react'); return React; });
  } };
  vm.runInNewContext(source, { window: win, document: doc, navigator: { platform: mac ? 'MacIntel' : 'Linux' }, console });
  const ctx = {
    layout: { toggleSidebar() { left++; } },
    sidebarRight: { toggleExpanded() { right++; } },
    effect: (setup) => { disposers.push(setup()); },
    get: (key) => key === 'slots' && !noSlots ? {
      inject(name, callback) { assert.equal(name, 'settings.section'); callback(); },
      register(options, component) {
        assert.equal(options.id, 'dsh-shortcuts'); assert.equal(options.label, 'Keyboard shortcuts');
        renderer = component;
      },
    } : undefined,
  };
  plugin.apply(ctx);
  function fire(overrides = {}) {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key: 'b', ctrlKey: !mac, metaKey: mac, altKey: false, shiftKey: false, ...overrides });
    doc.dispatchEvent(event); return event;
  }
  function render() { cursor = 0; return renderer(); }
  function all(node, type) { return [ ...(node?.type === type ? [node] : []), ...(node?.children ?? []).flatMap((child) => typeof child === 'object' && child ? all(child, type) : []) ]; }
  return { plugin, ctx, fire, render, all, data, storage, win, counts: () => [left, right], dispose: () => disposers.forEach((dispose) => dispose()) };
}

test('built client registers both platform shortcuts and removes listeners on dispose', () => {
  for (const mac of [false, true]) {
    const app = setup({ mac });
    assert.deepEqual(Array.from(app.plugin.inject), ['layout', 'sidebarRight']);
    assert.equal(app.fire().defaultPrevented, true);
    assert.equal(app.fire({ shiftKey: true }).defaultPrevented, true);
    assert.deepEqual(app.counts(), [1, 1]);
    app.dispose();
    assert.equal(app.fire().defaultPrevented, false);
    assert.deepEqual(app.counts(), [1, 1]);
  }
});

test('fresh empty right sidebar needs no active tab; missing seat is ignored', () => {
  const app = setup();
  app.ctx.sidebarRight.active = () => undefined;
  assert.equal(app.fire({ shiftKey: true }).defaultPrevented, true);
  app.ctx.sidebarRight.toggleExpanded = () => { throw new Error('sidebarRight: no session surface is mounted'); };
  assert.equal(app.fire({ shiftKey: true }).defaultPrevented, false);
});

test('preferences apply from startup and update from another tab', () => {
  const app = setup({ raw: JSON.stringify({ version: 1, left: 'Alt+L', right: '' }) });
  assert.equal(app.fire().defaultPrevented, false);
  assert.equal(app.fire({ key: 'l', ctrlKey: false, altKey: true }).defaultPrevented, true);
  const event = new Event('storage');
  Object.assign(event, { key: 'dsh-shortcuts:v1', storageArea: app.storage, newValue: JSON.stringify({ version: 1, left: 'Mod+X', right: '' }) });
  app.win.dispatchEvent(event);
  assert.equal(app.fire({ key: 'x' }).defaultPrevented, true);
  app.dispose();
});

test('settings saves immediately, validates conflicts, and restores defaults', () => {
  const app = setup();
  let tree = app.render();
  const inputKey = app.all(tree, 'input')[0].props.onKeyDown;
  let stopped = false;
  inputKey({ key: 'Escape', stopPropagation() { stopped = true; } });
  assert.equal(stopped, false);
  inputKey({ key: 'b', ctrlKey: true, stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  app.all(tree, 'input')[0].props.onChange({ target: { value: 'Alt+L' } });
  tree = app.render();
  app.all(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(app.fire().defaultPrevented, false);
  assert.equal(app.fire({ key: 'l', ctrlKey: false, altKey: true }).defaultPrevented, true);
  assert.equal(JSON.parse(app.data.get('dsh-shortcuts:v1')).left, 'Alt+L');
  tree = app.render();
  app.all(tree, 'input')[1].props.onChange({ target: { value: 'Alt+L' } });
  tree = app.render(); app.all(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = app.render();
  assert.ok(app.all(tree, 'p').some((p) => p.props.role === 'alert'));
  assert.equal(JSON.parse(app.data.get('dsh-shortcuts:v1')).right, 'Mod+Shift+B');
  app.all(tree, 'button')[1].props.onClick();
  assert.equal(app.fire().defaultPrevented, true);
  app.dispose();
});

test('defaults still work with blocked localStorage or no settings slot service', () => {
  const app = setup({ storageBlocked: true });
  assert.equal(app.fire().defaultPrevented, true);
  let tree = app.render();
  app.all(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = app.render();
  assert.ok(app.all(tree, 'p').some((p) => p.props.role === 'alert'));
  app.dispose();
  const headless = setup({ noSlots: true });
  assert.equal(headless.fire().defaultPrevented, true);
  headless.dispose();
});
