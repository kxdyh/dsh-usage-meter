# dsh-usage-meter 用量与余额仪表

A DeepSeek Harness (dsh) Client plugin that puts a **live usage + balance meter** at the foot of the
sidebar: context-window occupancy, cumulative token counts, and the signed-in account balance.

一个 DeepSeek Harness（dsh）客户端插件，在**侧边栏底部**提供实时的用量与余额仪表：上下文窗口占用率、
累计 token 用量，以及当前登录账号的余额。

```
上下文            45%   12.3K / 128K       ← contextPressure 投影
━━━━━━━━━━━━━━░░░░░░░░                     ← 占用条（≥70% 转琥珀色，≥90% 转红色）
余额                   ¥12.34              ← remote.account.getBalance()
```

Click the meter to expand input / output / cache-read / cache-write tokens and any bonus wallets.
When the sidebar is collapsed to its 56px rail the meter becomes a compact ring gauge.

点击仪表可展开输入 / 输出 / 缓存读取 / 缓存写入 token，以及赠送余额。当侧边栏收起为 56px 导轨时，
仪表会变成一个紧凑的环形指示器。

## What it registers 注册了什么

| Slot 插槽 | Kind 类型 | Scope 作用域 | Entry id 条目 ID |
|---|---|---|---|
| `sidebar.footer.action` | list 列表 | root 根 | `usage-meter` |

It only **adds** to that list (`replaceRisk: none`); it never replaces shipped UI. The widget is
declared by `@deepseek-ai/dsh-client-ui-sidebar`, so `dsh.client.inject` names that package to order
activation after it.

它只是向该列表**追加**一项（`replaceRisk: none`），永远不会替换任何自带界面。该插槽由
`@deepseek-ai/dsh-client-ui-sidebar` 声明，因此 `dsh.client.inject` 列出这个包，把本插件的激活顺序排在它之后。

## Where the numbers come from 数字从哪来

Everything is real, live host data — no polling of the model, no guessing.

全部是宿主实时提供的真实数据：不轮询模型，也不做任何估算。

| Shown 显示项 | Source 来源 | Notes 说明 |
|---|---|---|
| Context occupancy 上下文占用 | session projection `contextPressure` | `projectedTokens ?? pressureTokens` / `contextWindow` |
| Token totals token 累计 | session projection `tokenUsage` | `uncachedInputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens` |
| Balance 余额 | `ctx.remote.account.getBalance(clientMetadata)` | `{ status:'ready', value:[{currency,balance}], bonusWallets }` |
| Login state 登录状态 | `ctx.remote.account.watch(signal)` | 驱动刷新；余额本身没有推送通道 |

Read paths used, all documented:

用到的读取路径，全部有文档记录：

- `ctx.slots.inject(key, () => ctx.slots.register(options, Component))` — the slot contribution.
  插槽贡献的入口。
- `ctx.sessions.binding(sessionId)` → `binding.session.projections.faceOf(key)` — the client-side
  `ProjectionValueStore` faces the shipped `ContextMeter` also reads. The widget **borrows** the
  binding that the Conversation panel already retains; it never takes its own reference.
  客户端 `ProjectionValueStore` 的读取面，自带的 `ContextMeter` 读的也是同一份。本部件**借用**对话面板
  已经持有（retain）的那个 binding，自己从不额外增加引用计数。
- `useSessions` (a standard prop of root-scoped slots) selects the active conversation.
  `useSessions`（根作用域插槽的标准 prop）用于选出当前活跃的会话。
- `ctx.locale.register` / `ctx.locale.bind` for zh + en.
  通过 `ctx.locale.register` / `ctx.locale.bind` 提供中英文本。

### Honest limits 如实的限制

- **Token counts are not per-token streaming.** The host writes usage at step settlement, so numbers
  step per step. `projectedTokens` does move mid-turn as the prompt surface grows, which is why the
  occupancy percentage is the live-feeling number.

  **token 数不是逐 token 流式的。** 宿主只在每一步结算时才写入用量，所以数字按"步"跳动。不过
  `projectedTokens` 会在回合进行中随提示表面增长而移动，所以占用百分比才是那个"看起来实时"的数字。

- **No cost figure exists** in these contracts, so none is displayed.

  这些接口里**没有任何费用字段**，所以不显示费用。

- Projections are **per session** and cumulative over that session's log; there is no cross-session
  aggregate in the API.

  投影是**按会话**统计的，且是该会话日志的累计值；API 里没有跨会话的汇总。

- Balance is polled (60 s) plus refreshed on login-state changes, because the account namespace
  exposes no balance stream.

  余额每 60 秒轮询一次，并在登录状态变化时刷新 —— 因为账号命名空间没有提供余额推送流。

## Design constraints honoured 遵守的设计约束

- **No Harness client package is imported.** React comes from the page's platform module table
  (`require('react')`), and the widget is plain `React.createElement`.

  **不引入任何 Harness 客户端包。** React 取自页面的平台模块表（`require('react')`），部件本身是朴素的
  `React.createElement`。

- **Theme tokens only** (`--dsw-alias-*`), so it reads correctly in light and dark themes.

  **只用主题 token**（`--dsw-alias-*`），因此在浅色和深色主题下都显示正常。

- **No DOM writes outside the component.** The stylesheet and every subscription are registered as
  effects owned by the plugin fibre and disposed on unload/reload.

  **不在组件之外写 DOM。** 样式表和所有订阅都以 effect 形式注册、由插件 fibre 持有，在卸载 / 重载时释放。

- `aria-expanded` on the trigger, `aria-hidden` on the decorative ring.

  触发按钮带 `aria-expanded`，装饰性环形带 `aria-hidden`。

## Install 安装

The bundle is one package whose `package.json` declares `dsh.bundle.patch`; the patch inserts one
loader row.

整个 bundle 就是一个包，其 `package.json` 声明了 `dsh.bundle.patch`；该 patch 插入一行 loader 条目。

**From a local directory** — use the absolute path:

**从本地目录安装** —— 使用绝对路径：

```text
plugin_manager(install_bundle, target: "C:\\path\\to\\dsh-usage-meter")
```

or with the CLI:

或使用命令行：

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-usage-meter
```

**From a tarball** — the artifact this repo releases:

**从 tarball 安装** —— 即本仓库发布的产物：

```bash
dsh plugin --profile <profile> add /absolute/path/to/kxdyh-dsh-usage-meter-1.0.0.tgz
```

**From a registry** (after publishing, see below):

**从 registry 安装**（需先发布，见下文）：

```bash
dsh plugin --profile <profile> add @kxdyh/dsh-usage-meter
```

**From GitHub** (works as soon as the repository is public):

**从 GitHub 安装**（仓库公开后即可用）：

```bash
dsh plugin --profile <profile> add github:kxdyh/dsh-usage-meter
```

### Enabling / removing 启用与卸载

`dsh plugin` installs *and* selects the bundle. Removing it with
`plugin_manager(remove_bundle, target: "@kxdyh/dsh-usage-meter")` deselects, unloads, and runs
`pnpm remove`.

`dsh plugin` 会同时完成安装与选中。用
`plugin_manager(remove_bundle, target: "@kxdyh/dsh-usage-meter")` 卸载时，会取消选中、卸载运行时贡献，
并执行 `pnpm remove`。

### Reloading after an edit 修改后如何重载

There is no rebuild step — `client.js` is plain JavaScript served as-is. But a **code edit only
reaches an open page through the HMR watcher** (`pnpm run dev:web`). Without that watcher, toggle the
bundle off and on again (or restart the app) to force a graph re-scan.

没有构建步骤 —— `client.js` 是直接原样提供的纯 JavaScript。但**代码改动只会通过 HMR watcher**
（`pnpm run dev:web`）**才能到达已打开的页面**。若没有开那个 watcher，就把 bundle 关掉再打开一次
（或重启应用），以强制重新扫描模块图。

## Publishing to the community 发布到社区

A published dsh plugin **is an npm package that declares a bundle**. There is no separate plugin
file format. The installer (`plugin_manager` / `dsh plugin add`) accepts four spec forms:

已发布的 dsh 插件**就是一个声明了 bundle 的 npm 包**，并不存在单独的"插件文件格式"。安装器
（`plugin_manager` / `dsh plugin add`）接受四种 spec 形式：

| Spec form 形式 | Example 示例 |
|---|---|
| registry 注册表 | `dsh-usage-meter`, `@scope/dsh-usage-meter@1.0.0` |
| tarball 压缩包 | `/abs/path/name-1.0.0.tgz`, `https://host/name-1.0.0.tgz` |
| git | `github:user/repo`, `git+https://…`, `git@host:user/repo` |
| path 路径 | `/absolute/path/to/package`（必须是绝对路径） |

Community **discovery** is a GitHub topic plus awesome lists — marketplaces in the ecosystem browse
`github.com/topics/dsh-plugin`. So a community release is normally:

社区的**发现机制**是 GitHub topic 加各类 awesome 列表 —— 生态里的插件市场都在浏览
`github.com/topics/dsh-plugin`。所以一次社区发布通常是：

1. **Publish the repository** at `github.com/kxdyh/dsh-usage-meter` and tag it with the
   `dsh-plugin` topic (that topic is how the marketplaces find it);

   **发布仓库**到 `github.com/kxdyh/dsh-usage-meter`，并打上 `dsh-plugin` topic（市场就是靠这个 topic 找到你的）。

2. keep the `dsh-plugin` keyword in `package.json` (already present);

   在 `package.json` 里保留 `dsh-plugin` 关键词（已经加了）。

3. publish to npm: `pnpm publish --access public` (the scoped name needs
   `publishConfig.access = public`, already set);

   发布到 npm：`pnpm publish --access public`（scoped 包需要 `publishConfig.access = public`，已设置）。

4. optionally open a PR/issue against the community registries so they index it.

   可选：向社区 registry 仓库提 PR / issue 让其收录。

Until npm publication, `github:kxdyh/dsh-usage-meter` and the `.tgz` release artifact are both
installable, so the GitHub release alone is a complete community release.

在尚未发布 npm 之前，`github:kxdyh/dsh-usage-meter` 和 `.tgz` 产物都可以直接安装 —— 也就是说，
**只发 GitHub 就已经是一次完整的社区发布**。

> Note: `private` was intentionally removed from this manifest so the package is publishable. The
> local install in this machine's profile is a `link:` to this directory, so the running plugin is
> unaffected by that change.
>
> 说明：为了可发布，本清单中的 `private` 是特意去掉的。本机 profile 里的安装是指向该目录的 `link:`，
> 因此这一改动不影响正在运行的插件。

## Requirements 环境要求

- A dsh installation whose Web client composes `@deepseek-ai/dsh-client-ui-sidebar`,
  `@deepseek-ai/dsh-client-ui-slots`, the session controller and the account controller. These ship
  in the standard `dsh-web-app` bundle.

  dsh 安装的 Web 客户端需组合出 `@deepseek-ai/dsh-client-ui-sidebar`、`@deepseek-ai/dsh-client-ui-slots`、
  session controller 与 account controller。这些都在标准的 `dsh-web-app` bundle 中自带。

- The account half only shows a balance when the profile is signed in; otherwise it reads
  `未登录` / `Not signed in`. Token figures appear once the session has reported usage.

  只有 profile 处于登录状态时，余额部分才会显示数字；否则显示 `未登录` / `Not signed in`。
  token 数字会在该会话上报过用量后出现。

## License 许可证

MIT — see [LICENSE](LICENSE).

MIT，详见 [LICENSE](LICENSE)。
