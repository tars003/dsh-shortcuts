# Validation

## v0.2.0 — press-to-record and Settings shortcut

Developed against installed **DeepSeek Harness 0.1.5-rc.2**, Node.js **22.23.1**, and the installed Codex UI Settings implementation.

- `npm run check`: JavaScript syntax checks pass.
- `npm test`: 20 tests pass, covering parser/matcher behavior, actual-key recording (comma, shifted digits, Option symbols), Windows/Mac defaults, duplicate validation across three actions, old-preference migration without overwriting sidebar bindings, browser storage, generated bundle integration, capture cleanup, Escape/Tab behavior, blocked storage, and stock/Codex Settings adapters.
- `npm run build`: produces the committed `lib/client.js` with no third-party build dependencies.
- `npm pack --dry-run`: validates installable runtime files; nothing is published to npm.
- Chromium 155 + real React 18.2 smoke test: all three shortcuts from a composer textarea; press-to-record without executing old shortcuts; Escape cancels without reaching the shell; Tab exits; recording Ctrl+comma; save, conflict validation, disable and reset; no horizontal overflow at 360px; no page errors; unmount/dispose during active recording removes listeners.
- Stock Settings trigger markup and Codex trigger/account-launcher event behavior were inspected in the installed implementations. The Settings adapter is deliberately isolated because stock DSH exposes no public Settings-open controller.

## Scope and remaining manual check

The browser smoke test uses isolated sidebar controllers and slot doubles with the real generated plugin bundle and React, plus the verified stock trigger markup. This is **not** a claim that the new version was installed/restarted and tested in the user's authenticated running DSH page. The running profile was not changed or restarted.

After updating from GitHub and restarting DSH:

1. Refresh the authenticated page; existing saved sidebar shortcuts should remain unchanged.
2. Press Ctrl+, / Cmd+, to open Settings. If this combination previously belonged to a sidebar, the new Settings binding intentionally starts disabled.
3. Open Keyboard shortcuts, select each action and press a new combination, then Save.
4. During recording, confirm Escape cancels without closing Settings and Tab exits recording.
5. Test all three bindings, reload to confirm persistence, and check target browser/OS reserved shortcuts.

## Earlier validation (v0.1.0)

The initial version also passed real installed DSH `loadProfileDirectory` / `composeEntries` bundle resolution and real Cordis `Context` service-injection/Fiber-disposal checks. The user confirmed the original version works in their DSH GUI.

Source: https://github.com/dwb-ajay/dsh-shortcuts. No npm publication has been performed; the proposed package name has not been checked for registry availability.
