// DSH rc.2 owns Settings-open state inside its shell, not a public controller.
// This isolated, version-specific adapter activates its real accessible trigger
// via the stable Slot anchor, without replacing content or depending on labels.
export function openSettings(root) {
  const seat = root.querySelector('[data-slot="sidebar.settings"]');
  if (!seat) return false;
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
