import test from 'node:test';
import assert from 'node:assert/strict';
import { openSettings } from '../src/settings.js';

function fixture({ expanded = false, disabled = false, inert = false, codex = false } = {}) {
  let clicks = 0;
  const trigger = { disabled, getAttribute: () => String(expanded), closest: () => inert ? {} : null, click() { clicks++; } };
  const anchor = { closest: () => codex ? null : trigger };
  const seat = { contains: (node) => node === trigger,
    querySelector: (selector) => selector.includes('settings.trigger') ? anchor : selector.includes('data-dcu-settings-trigger') && codex ? trigger : null };
  return { root: { querySelector: () => seat }, trigger, seat, clicks: () => clicks };
}

test('Settings adapter activates stock and Codex triggers without closing an open page', () => {
  for (const codex of [false, true]) {
    const app = fixture({ codex });
    assert.equal(openSettings(app.root), true); assert.equal(app.clicks(), 1);
    const open = fixture({ codex, expanded: true });
    assert.equal(openSettings(open.root), true); assert.equal(open.clicks(), 0);
  }
});

test('Settings adapter leaves unavailable, disabled, inert or out-of-seat triggers untouched', () => {
  assert.equal(openSettings({ querySelector: () => null }), false);
  for (const options of [{ disabled: true }, { inert: true }]) {
    const app = fixture(options); assert.equal(openSettings(app.root), false); assert.equal(app.clicks(), 0);
  }
  const outside = fixture(); outside.seat.contains = () => false;
  assert.equal(openSettings(outside.root), false);
});

test('Codex account-launcher owner receives its explicitly supported open-root event', () => {
  const owner = new EventTarget(); let called = false;
  owner.closest = () => null;
  owner.addEventListener('dcu-settings-open-root', (event) => { called = true; event.preventDefault(); });
  const seat = { querySelector: () => owner };
  const root = { querySelector: (selector) => selector.includes('sidebar.settings') ? seat : null };
  assert.equal(openSettings(root), true);
  assert.equal(called, true);
  called = false;
  root.querySelector = (selector) => selector.includes('sidebar.settings') ? seat : {};
  assert.equal(openSettings(root), true);
  assert.equal(called, false); // Never reset an open page to General.
  root.querySelector = (selector) => selector.includes('sidebar.settings') ? seat : null;
  owner.closest = () => ({});
  assert.equal(openSettings(root), false);
  assert.equal(called, false);
});

function shellFixture({ expanded = false, disabled = false, itemDeferred = true } = {}) {
  let menuClicks = 0; let itemClicks = 0; let pending = null; let itemVisible = !itemDeferred;
  const item = {
    querySelector: (selector) => selector.includes('settings-outline') ? {} : null,
    click() { itemClicks++; },
  };
  const trigger = {
    disabled, click() { menuClicks++; pending?.(); },
    getAttribute: (name) => name === 'aria-label' ? 'Account menu' : String(expanded),
    querySelector: () => null,
  };
  const root = {
    querySelector: () => null,
    querySelectorAll: (selector) => selector.startsWith('button') ? [trigger]
      : itemVisible ? [item] : [],
  };
  globalThis.requestAnimationFrame = (callback) => { pending = callback; };
  const flush = () => { itemVisible = true; for (let i = 0; i < 5 && pending; i++) { const next = pending; pending = null; next(); } };
  return { root, flush, menuClicks: () => menuClicks, itemClicks: () => itemClicks };
}

test('Settings adapter opens the shell account menu and its Settings item on 0.2.x', () => {
  const shell = shellFixture();
  assert.equal(openSettings(shell.root), true);
  assert.equal(shell.menuClicks(), 1);
  assert.equal(shell.itemClicks(), 0); // The menu renders after the click.
  shell.flush();
  assert.equal(shell.itemClicks(), 1);
  const open = shellFixture({ expanded: true, itemDeferred: false });
  assert.equal(openSettings(open.root), true);
  assert.equal(open.menuClicks(), 0);
  assert.equal(open.itemClicks(), 1);
  assert.equal(openSettings(shellFixture({ disabled: true }).root), false);
  assert.equal(openSettings({ querySelector: () => null, querySelectorAll: () => [] }), false);
  assert.equal(openSettings({ querySelector: () => null }), false);
  delete globalThis.requestAnimationFrame;
});

test('an empty 0.2.x sidebar seat falls through to the account menu', () => {
  let clicks = 0;
  const seat = { querySelector: () => null, contains: () => false };
  const trigger = {
    disabled: false, click() { clicks++; },
    getAttribute: (name) => name === 'aria-label' ? 'Account menu' : 'false',
    querySelector: () => null,
  };
  const item = { querySelector: (selector) => selector.includes('settings-outline') ? {} : null, click() { clicks++; } };
  const root = {
    querySelector: (selector) => selector.includes('sidebar.settings') ? seat : null,
    querySelectorAll: (selector) => selector.startsWith('button') ? [trigger] : [item],
  };
  assert.equal(openSettings(root), true);
  assert.equal(clicks, 2); // menu trigger, then the Settings item
});
