# Agent notes

Operational facts for anyone (human or agent) changing this plugin. Product docs live in `README.md`.

## Installed copies pin a commit

DSH profiles install this plugin from Git, and pnpm records the resolved commit in
`$DSH_HOME/profiles/<name>/pnpm-lock.yaml`:

```yaml
dsh-shortcuts:
  specifier: git+https://github.com/dwb-ajay/dsh-shortcuts.git
  version: git+https://github.com/dwb-ajay/dsh-shortcuts.git#<sha>
```

- Pushing to `main` changes nothing for an existing install.
- After a **functional** change, refresh the install explicitly:

  ```sh
  cd "$DSH_HOME/profiles/web"
  pnpm add github:dwb-ajay/dsh-shortcuts     # or: dsh plugin --profile web add github:dwb-ajay/dsh-shortcuts
  ```

  then restart `dsh web` and reload the browser page. Removing/readding may be
  required when DSH runs with HMR (`already-installed`).
- After a **docs-only** commit this step is unnecessary; the running bundle is `lib/client.js`.

## Runtime requirements

- DSH 0.2.x needs **Node.js 24.9+**. Verify with `node --version` in the shell that
  starts `dsh`; a global `dsh` from an older Node crashes on a 0.2.x profile.
- `engines.dsh` in `package.json` is what DSH's compatibility check reads. Keep the
  range honest when support changes; otherwise installs are refused.
- Target versions: 0.1.5-rc.x (legacy paths still present) and 0.2.2-rc.x (current).

## Before committing

```sh
npm run check      # syntax
npm test           # unit + built-client integration
npm run build      # regenerate lib/client.js
```

`lib/client.js` is committed on purpose: GitHub installs consume it and run no build
step. Always commit it with `src/` changes, or installed users get the old bundle.

## Where the version-specific bits are

- `src/settings.js` — opens Settings. Two adapters: the `sidebar.settings` seat
  (0.1.x, incl. Codex UI account-launcher event) and, falling through, the shell
  account menu plus its `#dsw-icon-settings-outline-medium` item (0.2.x).
  An empty seat placeholder must fall through, not give up.
- `src/client.js` — picks the settings slot (`settings.section` on 0.1.x,
  `settings.general.item` when `ctx.get('shortcuts')` exists), and skips chords the
  framework registry already owns (`claimedByFramework`), because both handlers
  running means two toggles and a visible no-op.
- `src/shortcuts.js` — parsing/recording plus `describeEventBinding` /
  `claimedByFramework`. Binding modifiers are `primary | control | meta | alt | shift`
  with physical `KeyboardEvent.code`, matching DSH's registry contract.

## Do not

- Do not add a second manual plugin row to a profile: `cordis.patch.yml` already
  inserts the bundle.
- Do not assume the browser settings UI is the only shortcut editor on 0.2.x; DSH
  ships its own, and the two stores are independent (`dsh-shortcuts:v1` here,
  `dsh.keybindings.v1` there).
- Do not remove the fallthrough in `openSettings` when a seat exists but is empty —
  0.2.x shells render the seat as a placeholder without a trigger.
