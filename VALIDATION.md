# Validation

Developed against the locally installed **DeepSeek Harness 0.1.5-rc.2** and Node.js **22.23.1**.

Completed checks:

- `npm run check`: JavaScript syntax checks pass.
- `npm test`: 14 tests pass (platform modifiers, parsing, conflict validation, exact keyboard matching, IME/AltGr/repeat handling, browser preferences, generated bundle loading, missing right-sidebar seat, settings actions, and listener cleanup).
- `npm run build`: produces a deterministic `lib/client.js`.
- `npm pack`: creates the installable `dsh-shortcuts-0.1.0.tgz`, with only the manifest, bundle patch, host entry, built client, README, and license.
- Real installed DSH `loadProfileDirectory` / `composeEntries`: local test-profile resolves this bundle and inserts its row.
- Real installed Cordis `Context`: injected-service activation reaches ACTIVE and disposing its Fiber removes the native keyboard listener.
- Chromium 155 + real React 18.2 smoke test: renders the settings section, exercises both keyboard shortcuts from a composer textarea, changes a binding, rejects conflicting bindings, restores defaults, verifies 360px viewport has no horizontal overflow, and unmounts/cleans up without page errors.

## Scope and remaining manual check

The Chromium smoke test used isolated controller/slot doubles with the real generated plugin bundle and React. The actual DSH GUI requires authentication, so this is **not** a claim of end-to-end validation in the user's authenticated running page. The active DSH profile was not modified and its server was not restarted.

After installing into a DSH profile and restarting it:

1. Refresh the authenticated DSH browser page.
2. Press Ctrl+B / Cmd+B twice; confirm the left sidebar collapses and returns.
3. With a session open, press Ctrl+Shift+B / Cmd+Shift+B twice; confirm the right sidebar toggles without losing tabs.
4. Open Settings → Keyboard shortcuts, change each binding, save, and try the new combinations.
5. Reload the page and confirm preferences persist. Check any target browsers/platforms for reserved keyboard shortcuts and editor/terminal conflicts.

The source repository is hosted at https://github.com/dwb-ajay/dsh-shortcuts and supports direct GitHub installation. No package has been published to npm; the proposed package name has not been checked for registry availability.
