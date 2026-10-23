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
