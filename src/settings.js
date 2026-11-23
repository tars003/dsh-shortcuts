// DSH owns Settings-open state inside its shell, not a public controller.
// This isolated, version-specific adapter activates its real accessible trigger
// via stable anchors, without replacing content or depending on labels.
//
// Two shells are supported, in order:
//   * the stock sidebar seat  [data-slot="sidebar.settings"] (DSH 0.1.x)
//   * the shell's account menu whose Settings item carries the stock icon id
//     #dsw-icon-settings-outline-medium (DSH 0.2.x, incl. Codex UI 2.x)
export function openSettings(root) {
  const seat = root.querySelector('[data-slot="sidebar.settings"]');
  if (seat && openFromSeat(seat, root)) return true;
  return openFromAccountMenu(root);
}

/** Activate the stock sidebar seat, which may be an empty placeholder. */
function openFromSeat(seat, root) {
  // Codex UI can host an account launcher instead of the stock button. Its
  // owner explicitly handles this cancelable event; no click is needed then.
  const owner = seat.querySelector('[data-dcu-settings-owner]');
  if (owner) {
    // An already-open account-launcher page may make its sidebar inert.
    // Preserve the current section rather than navigating back to General.
    if (root.querySelector('[data-dcu-settings-page]')) return true;
    if (owner.closest('[inert]')) return false;
    if (!owner.dispatchEvent(new CustomEvent('dcu-settings-open-root', { cancelable: true }))) return true;
  }
  const content = seat.querySelector('[data-slot="settings.trigger"]');
  const trigger = content?.closest('button[aria-haspopup="dialog"]')
    ?? seat.querySelector('button[data-dcu-settings-trigger]');
  if (!trigger || !seat.contains(trigger) || trigger.disabled) return false;
  if (trigger.getAttribute('aria-expanded') === 'true') return true;
  if (trigger.closest('[inert]')) return false;
  if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
  return true;
}

const SETTINGS_ICON = '#dsw-icon-settings-outline-medium';
const MENU_TRIGGER_ICON = '#dsw-icon-ellipsis-outline-medium';

/** Open the shell's account menu, then its Settings item, once the menu renders. */
function openFromAccountMenu(root) {
  if (typeof root.querySelectorAll !== 'function') return false;
  const menus = [...root.querySelectorAll('button[aria-haspopup="menu"]')];
  const trigger = menus.find((button) => /account/i.test(button.getAttribute('aria-label') ?? ''))
    ?? menus.find((button) => button.querySelector(`use[href="${MENU_TRIGGER_ICON}"]`) !== null);
  if (!trigger || trigger.disabled) return false;

  const findItem = () => [...root.querySelectorAll('[role="menuitem"]')]
    .find((item) => item.querySelector(`use[href="${SETTINGS_ICON}"]`) !== null) ?? null;
  if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();

  const item = findItem();
  if (item) { item.click(); return true; }
  // The menu mounts on the next frame; click the item as soon as it exists.
  const frame = typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : (callback) => setTimeout(callback, 0);
  let attempts = 0;
  const settle = () => {
    const rendered = findItem();
    if (rendered) { rendered.click(); return; }
    if (++attempts < 40) frame(settle);
  };
  frame(settle);
  return true;
}
