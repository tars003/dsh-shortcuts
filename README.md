# dsh-shortcuts

Press-to-record keyboard shortcuts for sidebars and Settings in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Toggle left sidebar | **Ctrl+B** | **Cmd+B** |
| Toggle right sidebar | **Ctrl+Shift+B** | **Cmd+Shift+B** |
| Open Settings | **Ctrl+,** | **Cmd+,** |

Open **Settings → Keyboard shortcuts**, select an action's shortcut, and **press your new key combination**—no shortcut syntax to type. Select **Save shortcuts** to apply. Each action also has a **Disable** button. Preferences persist in this browser and synchronize across its same-origin tabs; they are not account-wide or server settings.

## Install from GitHub

Requires Node.js 22+, pnpm on PATH, and DSH's profile-bundle/client-plugin API. The plugin uses `layout.toggleSidebar()` and `sidebarRight.toggleExpanded()`; other DSH versions must retain these APIs.

| DSH | Status | Notes |
| --- | --- | --- |
| 0.1.5-rc.x | works | Settings opened from the `sidebar.settings` slot; settings section registered as `settings.section` |
| 0.2.2-rc.x | works (this release) | Settings opened from the shell's account menu; section registered as `settings.general.item`; chords already owned by DSH's client shortcut registry are skipped |
| other | untested | `package.json` declares `engines.dsh: ">=0.1.5-rc.1 <0.3.0-0"`, so DSH's plugin-compatibility check refuses anything outside that range |

DSH 0.2.x requires **Node.js 24.9+**; make sure the shell that starts `dsh` has it (`node --version`). A global `dsh` installed under an older node starts fine but crashes on a 0.2.x profile, so a launcher that pins the runtime is safest:

```sh
#!/usr/bin/env bash
exec /path/to/node24/bin/node /path/to/node24/lib/node_modules/@deepseek-ai/dsh/lib/bin.js "$@"
```

```sh
dsh plugin --profile web add github:dwb-ajay/dsh-shortcuts
```

Restart the existing DSH web process, then refresh its browser page. Installation declares the bundle automatically; do not add a second manual plugin row. This repository includes its built client file, so installing does not run a build/prepare script. No ZIP download or npm publication is needed.

For reproducible installs append `#<tag-or-commit>` to the GitHub specifier.

**Not published on npm yet.** The package name is a working name; npm availability has not been checked.

### Update an existing installation

```sh
dsh plugin --profile web add github:dwb-ajay/dsh-shortcuts#v0.3.0
```

Restart DSH and refresh your browser. The explicit tag avoids reusing an older cached GitHub revision. Existing customized sidebar shortcuts are preserved. If one already uses Ctrl/Cmd+comma, the new Settings shortcut is left disabled until you assign a different combination.

#### The profile pins a commit, not a branch

Because the profile installs from Git, pnpm records the **exact commit** it resolved:

```yaml
# $DSH_HOME/profiles/<name>/pnpm-lock.yaml
dsh-shortcuts:
  specifier: git+https://github.com/dwb-ajay/dsh-shortcuts.git
  version: git+https://github.com/dwb-ajay/dsh-shortcuts.git#d5b24d64688c628c52fd8954895f5d2370ed9420
```

Pushing to `main` therefore does **not** change an installed copy — the profile keeps serving the pinned commit until someone refreshes it. New commits need one explicit step, run in the profile directory:

```sh
cd "$DSH_HOME/profiles/web"
pnpm add github:dwb-ajay/dsh-shortcuts
```

`dsh plugin --profile web add github:dwb-ajay/dsh-shortcuts` does the same thing (it forwards to pnpm). Then restart `dsh web` and reload the page in the browser; a page reload alone keeps running the old bundle. If DSH was launched with HMR, a plugin reinstall can be refused with `already-installed` — remove it first or restart.

Docs-only commits do not require this: the running bundle is `lib/client.js`, so a README change can wait until the next functional update.

### Install from a development checkout

```sh
# Run from this repository:
dsh plugin --profile web add "$(pwd)"
```

Alternatively use an absolute checkout path, including in PowerShell. Restart DSH and refresh the page afterward.

## Configure

1. Open the plugin's **Keyboard shortcuts** section (Ctrl+, on Windows/Linux; Cmd+, on Mac), or reach it by hand: **Settings → General → Keyboard shortcuts**. On a stock 0.1.x shell the Settings entry lives in the sidebar; on 0.2.x shells (including Codex UI 2.x) it lives in the account menu at the bottom of the sidebar.
2. Select the shortcut button for an action. It displays **Press keys…**.
3. Hold your modifiers and press the key you want. For example, hold Ctrl+Alt and press L. Modifier-only presses wait for a key.
4. Select **Save shortcuts**. Changes do not apply until saved.

**Escape** cancels recording without closing Settings. **Tab / Shift+Tab** exits recording and moves focus normally. Clicking another control or leaving the browser window cancels recording. **Disable** clears an action's draft binding; save to apply it. **Restore defaults** resets and saves all three bindings immediately.

Include **Ctrl**, **Command**, or **Alt/Option** so ordinary typing is never bound; Shift may be added. Supported keys: letters, digits, comma, F1–F24, Space, Enter, modified Escape, arrows, Home, End, PageUp, and PageDown. Unsupported keys show an inline error and let you try again. Duplicate combinations across all three actions are rejected on Save.

Bindings normally use the logical `KeyboardEvent.key`. If Shift or Alt/Option transforms a letter/digit/comma into a symbol or dead key (for example `Shift+1` → `!` or Mac `Option+R` → `®`), recording and matching fall back to that key's physical `KeyboardEvent.code`. On non-US layouts, choose a different binding if that fallback feels unexpected. Recorded modifiers are explicit to your platform; defaults use portable Ctrl/Command equivalents.

### Browser and editor conflicts

Browsers and operating systems reserve some combinations. For example, Ctrl+Shift+B commonly toggles a browser bookmarks bar; DSH handles it when the browser delivers the event, but not every browser/OS allows interception. Choose another binding if it conflicts. Avoid OS/browser navigation shortcuts.

The listener runs in the bubble phase and respects keys already consumed by the page. It works in the chat composer, but an editor/terminal that handles a combination first keeps it (for example Ctrl+B for bold or terminal navigation). It avoids repeated toggles while a key is held, suppresses repeats of a shortcut it handled, and ignores IME composition and AltGr. While recording, global shortcuts are suspended and key events are intercepted before the Settings shell, so recording never activates an existing shortcut.

The right shortcut does nothing when DSH has no session surface mounted. It does not create a session or close tabs. Both sidebar shortcuts use DSH controllers; no DOM selectors or simulated clicks are used for sidebar toggling.

**Settings compatibility:** DSH exposes no public "open Settings" command, so `src/settings.js` is a narrow, version-specific adapter that activates a real trigger:

1. the `sidebar.settings` slot's `settings.trigger` button (stock 0.1.x), including Codex UI's account-launcher `dcu-settings-open-root` event;
2. failing that, the shell's account menu (`button[aria-haspopup="menu"]`, matched by its `aria-label` or the stock ellipsis icon) and then the item carrying the stock `#dsw-icon-settings-outline-medium` icon (0.2.x, Codex UI 2.x) — the menu renders a frame late, so the item is clicked as soon as it appears.

It never replaces the Settings shell, translated labels, or slot content. If a future shell has no recognized trigger the shortcut does nothing and leaves the browser event unconsumed; that is the one place an adapter update is needed.

**Chords DSH already owns are skipped.** 0.2.x ships a client shortcut registry (`ctx.shortcuts`, ids such as `sidebar.left.toggle` / `sidebar.right.toggle`). Each key event is described to `shortcuts.describeBinding()` and, when it reports a conflict, this plugin leaves the event alone. Without that guard both handlers would run and toggle twice — visibly no response (web-on-macOS/Windows binds Cmd/Ctrl+Shift+B by default). The guard is inert on 0.1.x, which has no registry.

**Native editing exists on 0.2.x too.** DSH 0.2 ships its own press-to-record editor (Settings → General → Work details → *Edit shortcuts*, plus a Mod+/ reference overlay). This plugin remains useful for its defaults (Mod+B / Mod+Shift+B / Mod+,) and for shells whose native editor is not reachable, but the two write independent stores: browser storage here, `dsh.keybindings.v1` there.

If browser storage is blocked, default shortcuts still work. Saving reports an error rather than pretending preferences were persisted. Clearing site data resets preferences. Removing the plugin leaves only its small `dsh-shortcuts:v1` local-storage entry; remove it in browser devtools if desired.

## Remove

```sh
dsh plugin --profile web remove dsh-shortcuts
```

Restart DSH and refresh the page. Listener/slot cleanup is also tied to the Cordis plugin lifecycle.

## Develop

No third-party build or runtime dependencies are required. React is supplied by DSH's browser module table.

```sh
npm run check
npm test
npm run build
npm pack --dry-run
```

Edit `src/`, then rebuild. **Commit `lib/client.js`** with source changes: GitHub installs consume that prebuilt bundle. CI verifies that it is current. `npm pack` runs checks, tests, and a rebuild; it does not publish.

Structure:

- `cordis.patch.yml`: profile-level bundle insertion.
- `src/index.js`: no-op host entry; no model tools or server permissions.
- `src/client.js`: lifecycle-managed keyboard listeners, framework-chord guard, and additive settings section.
- `src/shortcuts.js`, `src/preferences.js`: testable recording/matching, registry-conflict detection (`describeEventBinding`, `claimedByFramework`), and backward-compatible browser preferences.
- `src/settings.js`: isolated Settings-opening compatibility adapter.
- `scripts/build.mjs`: dependency-free DSH lazy-factory bundle generation.
- `lib/client.js`: browser artifact consumed by DSH.
- `test/`: parser, matching, preferences, and built-client integration tests.

The plugin belongs in the **host profile composition** because it is a global browser feature, not an agent preset. It contributes browser behavior only. No shipped preset or DSH installation files need modification.

### Publish later

1. Pick an available npm package name; if renamed, update `package.json`, `cordis.patch.yml`, and the bundle ID in `scripts/build.mjs`, then rebuild.
2. Confirm the repository/homepage/bugs metadata and your license attribution.
3. Run the checks above, install the packed tarball into DSH, and verify all three shortcuts in your target browsers.
4. When ready, publish explicitly with `npm publish --access public` (not performed by this repository's CI).

## License

MIT.
