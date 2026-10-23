# dsh-shortcuts

Configurable keyboard shortcuts for the left and right sidebars in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Toggle left sidebar | **Ctrl+B** | **Cmd+B** |
| Toggle right sidebar | **Ctrl+Shift+B** | **Cmd+Shift+B** |

Open **Settings → Keyboard shortcuts** to change either combination or leave a field empty to disable it. Preferences persist in this browser and synchronize across its same-origin tabs. They are not account-wide or server settings.

## Install from GitHub

Requires Node.js 22+, pnpm on PATH, and DSH's profile-bundle/client-plugin API (developed against **DSH 0.1.5-rc.2**). The plugin uses `layout.toggleSidebar()` and `sidebarRight.toggleExpanded()`; other DSH versions must retain these APIs.

```sh
dsh plugin --profile web add github:dwb-ajay/dsh-shortcuts
```

Restart the existing DSH web process, then refresh its browser page. Installation declares the bundle automatically; do not add a second manual plugin row. This repository includes its built client file, so installing does not run a build/prepare script. No ZIP download or npm publication is needed.

For reproducible installs append `#<tag-or-commit>` to the GitHub specifier.

**Not published on npm yet.** The package name is a working name; npm availability has not been checked.

### Install from a development checkout

```sh
# Run from this repository:
dsh plugin --profile web add "$(pwd)"
```

Alternatively use an absolute checkout path, including in PowerShell. Restart DSH and refresh the page afterward.

## Configure

In **Settings → Keyboard shortcuts**, type a shortcut string and select **Save shortcuts**. Use **Restore defaults** to reset both.

- `Mod+B`: Command on macOS, Ctrl elsewhere.
- `Ctrl+Alt+L`: explicit Control modifier.
- `Cmd+Shift+R`: explicit Command modifier.
- `Alt+Shift+R`: alternate combination.
- Empty string: disable that action.

Supported modifiers: `Mod`, `Ctrl` / `Control`, `Cmd` / `Command` / `Meta`, `Alt` / `Option`, and `Shift`. Order and case do not matter. Keys: letters, digits, F1–F24, Space, Enter, Escape / Esc, arrows, Home, End, PageUp, and PageDown. Require Ctrl, Cmd, Mod, or Alt so ordinary typing is never bound. Duplicate combinations are rejected for the current platform. Bindings normally use the logical `KeyboardEvent.key`. If Shift or Alt/Option transforms a letter/digit into a symbol or dead key (for example `Shift+1` → `!` or Mac `Option+R` → `®`), matching falls back to that letter/digit's physical `KeyboardEvent.code`. On non-US layouts, choose a different binding if that fallback feels unexpected.

### Browser and editor conflicts

Browsers and operating systems reserve some combinations. For example, Ctrl+Shift+B commonly toggles a browser bookmarks bar; DSH handles it when the browser delivers the event, but not every browser/OS allows interception. Choose another binding if it conflicts. Avoid OS/browser navigation shortcuts.

The listener runs in the bubble phase and respects keys already consumed by the page. It works in the chat composer, but an editor/terminal that handles a combination first keeps it (for example Ctrl+B for bold or terminal navigation). It avoids repeated toggles while a key is held, suppresses repeats of a shortcut it handled, and ignores IME composition and AltGr. The plugin's own shortcut inputs never activate the global shortcuts.

The right shortcut does nothing when DSH has no session surface mounted. It does not create a session or close tabs. Both shortcuts use DSH controllers; no DOM selectors or simulated clicks are used for toggling.

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
- `src/client.js`: lifecycle-managed keyboard listeners and additive settings section.
- `src/shortcuts.js`, `src/preferences.js`: testable matching and browser preferences.
- `scripts/build.mjs`: dependency-free DSH lazy-factory bundle generation.
- `lib/client.js`: browser artifact consumed by DSH.
- `test/`: parser, matching, preferences, and built-client integration tests.

The plugin belongs in the **host profile composition** because it is a global browser feature, not an agent preset. It contributes browser behavior only. No shipped preset or DSH installation files need modification.

### Publish later

1. Pick an available npm package name; if renamed, update `package.json`, `cordis.patch.yml`, and the bundle ID in `scripts/build.mjs`, then rebuild.
2. Confirm the repository/homepage/bugs metadata and your license attribution.
3. Run the checks above, install the packed tarball into DSH, and verify both shortcuts in your target browsers.
4. When ready, publish explicitly with `npm publish --access public` (not performed by this repository's CI).

## License

MIT.
