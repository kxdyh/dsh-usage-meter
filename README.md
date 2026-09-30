# dsh-usage-meter

A DeepSeek Harness (dsh) Client plugin that puts a **live usage + balance meter** at the foot of the
sidebar: context-window occupancy, cumulative token counts, and the signed-in account balance.

```
上下文            45%   12.3K / 128K       ← contextPressure projection
━━━━━━━━━━━━━━░░░░░░░░                     ← occupancy bar (turns amber ≥70%, red ≥90%)
余额                   ¥12.34              ← remote.account.getBalance()
```

Click the meter to expand input / output / cache-read / cache-write tokens and any bonus wallets.
When the sidebar is collapsed to its 56px rail the meter becomes a compact ring gauge.

## What it registers

| Slot | Kind | Scope | Entry id |
|---|---|---|---|
| `sidebar.footer.action` | list | root | `usage-meter` |

It only **adds** to that list (`replaceRisk: none`); it never replaces shipped UI. The widget is
declared by `@deepseek-ai/dsh-client-ui-sidebar`, so `dsh.client.inject` names that package to order
activation after it.

## Where the numbers come from

Everything is real, live host data — no polling of the model, no guessing.

| Shown | Source | Notes |
|---|---|---|
| Context occupancy | session projection `contextPressure` | `projectedTokens ?? pressureTokens` over `contextWindow` |
| Token totals | session projection `tokenUsage` | `uncachedInputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens` |
| Balance | `ctx.remote.account.getBalance(clientMetadata)` | `{ status:'ready', value:[{currency,balance}], bonusWallets }` |
| Login state | `ctx.remote.account.watch(signal)` | drives refresh; balance itself has no push channel |

Read paths used, all documented:

- `ctx.slots.inject(key, () => ctx.slots.register(options, Component))` — the slot contribution.
- `ctx.sessions.binding(sessionId)` → `binding.session.projections.faceOf(key)` — the client-side
  `ProjectionValueStore` faces the shipped `ContextMeter` also reads. The widget **borrows** the
  binding that the Conversation panel already retains; it never takes its own reference.
- `useSessions` (a standard prop of root-scoped slots) selects the active conversation.
- `ctx.locale.register` / `ctx.locale.bind` for zh + en.

### Honest limits

- **Token counts are not per-token streaming.** The host writes usage at step settlement, so numbers
  step per step. `projectedTokens` does move mid-turn as the prompt surface grows, which is why the
  occupancy percentage is the live-feeling number.
- **No cost figure exists** in these contracts, so none is displayed.
- Projections are **per session** and cumulative over that session's log; there is no cross-session
  aggregate in the API.
- Balance is polled (60 s) plus refreshed on login-state changes, because the account namespace
  exposes no balance stream.

## Design constraints honoured

- **No Harness client package is imported.** React comes from the page's platform module table
  (`require('react')`), and the widget is plain `React.createElement`.
- **Theme tokens only** (`--dsw-alias-*`), so it reads correctly in light and dark themes.
- **No DOM writes outside the component.** The stylesheet and every subscription are registered as
  effects owned by the plugin fibre and disposed on unload/reload.
- `aria-expanded` on the trigger, `aria-hidden` on the decorative ring.

## Install

The bundle is one package whose `package.json` declares `dsh.bundle.patch`; the patch inserts one
loader row.

**From a local directory** — use the absolute path:

```text
plugin_manager(install_bundle, target: "C:\\path\\to\\dsh-usage-meter")
```

or with the CLI:

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-usage-meter
```

**From a tarball** — the artifact this repo releases:

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-usage-meter-1.0.0.tgz
```

**From a registry** (after publishing, see below):

```bash
dsh plugin --profile <profile> add @kxdyh/dsh-usage-meter
```

**From GitHub** (works as soon as the repository is public):

```bash
dsh plugin --profile <profile> add github:kxdyh/dsh-usage-meter
```

### Enabling / removing

`dsh plugin` installs *and* selects the bundle. Removing it with
`plugin_manager(remove_bundle, target: "@kxdyh/dsh-usage-meter")` deselects, unloads, and runs
`pnpm remove`.

### Reloading after an edit

There is no rebuild step — `client.js` is plain JavaScript served as-is. But a **code edit only
reaches an open page through the HMR watcher** (`pnpm run dev:web`). Without that watcher, toggle the
bundle off and on again (or restart the app) to force a graph re-scan.

## Publishing to the community

A published dsh plugin **is an npm package that declares a bundle**. There is no separate plugin
file format. The installer (`plugin_manager` / `dsh plugin add`) accepts four spec forms:

| Spec form | Example |
|---|---|
| registry | `dsh-usage-meter`, `@scope/dsh-usage-meter@1.0.0` |
| tarball | `/abs/path/name-1.0.0.tgz`, `https://host/name-1.0.0.tgz` |
| git | `github:user/repo`, `git+https://…`, `git@host:user/repo` |
| path | `/absolute/path/to/package` (must be absolute) |

Community **discovery** is a GitHub topic plus awesome lists — marketplaces in the ecosystem browse
`github.com/topics/dsh-plugin`. So a community release is normally:

1. **Publish the repository** at `github.com/kxdyh/dsh-usage-meter` and tag it with the
   `dsh-plugin` topic (that topic is how the marketplaces find it);
2. keep the `dsh-plugin` keyword in `package.json` (already present);
3. publish to npm: `pnpm publish --access public` (the scoped name needs
   `publishConfig.access = public`, already set);
4. optionally open a PR/issue against the community registries so they index it.

Until npm publication, `github:kxdyh/dsh-usage-meter` and the `.tgz` release artifact are both
installable, so the GitHub release alone is a complete community release.

> Note: `private` was intentionally removed from this manifest so the package is publishable. The
> local install in this machine's profile is a `link:` to this directory, so the running plugin is
> unaffected by that change.

## Requirements

- A dsh installation whose Web client composes `@deepseek-ai/dsh-client-ui-sidebar`,
  `@deepseek-ai/dsh-client-ui-slots`, the session controller and the account controller. These ship
  in the standard `dsh-web-app` bundle.
- The account half only shows a balance when the profile is signed in; otherwise it reads
  `未登录` / `Not signed in`. Token figures appear once the session has reported usage.

## License

MIT — see [LICENSE](LICENSE).
