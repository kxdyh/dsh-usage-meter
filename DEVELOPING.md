# Developing dsh-usage-meter 开发文档

> This file is for contributors. User-facing documentation lives in [README.md](README.md).
>
> 本文件面向贡献者。面向用户的说明见 [README.md](README.md)。

## What it registers 注册了什么

| Slot 插槽 | Kind 类型 | Scope 作用域 | Entry id 条目 ID |
|---|---|---|---|
| `sidebar.footer.action` | list 列表 | root 根 | `usage-meter` |

It only **adds** to that list (`replaceRisk: none`); it never replaces shipped UI. The widget is
declared by `@deepseek-ai/dsh-client-ui-sidebar`, so `dsh.client.inject` names that package to order
activation after it.

它只是向该列表**追加**一项（`replaceRisk: none`），永远不会替换任何自带界面。该插槽由
`@deepseek-ai/dsh-client-ui-sidebar` 声明，因此 `dsh.client.inject` 列出这个包，把本插件的激活顺序排在它之后。

The entry renders `null`-safe: the shipped `cordis-panel` occupant renders nothing when no dynamic
package is loaded, so this widget is normally the only visible entry in that row.

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

- **The balance is never put through a float.** `formatMoney` renders the platform's decimal
  *string* directly, so it keeps the reported precision: up to **7** fractional digits with a
  **2**-digit (cent) floor. Trailing zeros above the floor are trimmed, and digits past the 7th are
  truncated — never rounded up, so the display can never overstate the balance.

  **余额从不经过浮点数。** `formatMoney` 直接按平台返回的十进制**字符串**渲染，因此保留原始精度：
  最多 **7** 位小数，最少 **2** 位（分）。超出「分」的末尾零会去掉，第 7 位之后的数字直接截断 ——
  不做进位，所以显示值永远不会高估余额。

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

## Reloading after an edit 修改后如何重载

There is no rebuild step — `client.js` is plain JavaScript served as-is. But a **code edit only
reaches an open page through the HMR watcher** (`pnpm run dev:web`). Without that watcher, toggle the
bundle off and on again (or restart the app) to force a graph re-scan. The browser artifact's
`__ModuleLoader__.load({ id })` **must equal the package name**, and the stylesheet tag identity
follows it.

没有构建步骤 —— `client.js` 是直接原样提供的纯 JavaScript。但**代码改动只会通过 HMR watcher**
（`pnpm run dev:web`）**才能到达已打开的页面**。若没有开那个 watcher，就把 bundle 关掉再打开一次
（或重启应用），以强制重新扫描模块图。浏览器产物的 `__ModuleLoader__.load({ id })` **必须等于包名**，
样式表标签标识也跟着它走。

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

1. **Publish the repository** and tag it with the `dsh-plugin` topic (that topic is how the
   marketplaces find it). **发布仓库**并打上 `dsh-plugin` topic（市场就是靠这个 topic 找到你的）。
2. Keep the `dsh-plugin` keyword in `package.json` (already present).
   在 `package.json` 里保留 `dsh-plugin` 关键词（已经加了）。
3. Publish to npm: `pnpm publish --access public` (a scoped name needs
   `publishConfig.access = public`, already set). Note that a **read-only mirror** such as
   `registry.npmmirror.com` cannot be published to — pass the official registry explicitly:
   `pnpm publish --registry https://registry.npmjs.org`.
   发布到 npm：`pnpm publish --access public`（scoped 包需要 `publishConfig.access = public`，已设置）。
   注意 `registry.npmmirror.com` 这类**只读镜像发不上去**，要显式指定官方源：
   `pnpm publish --registry https://registry.npmjs.org`。
4. Optionally open a PR/issue against the community registries so they index it.
   可选：向社区 registry 仓库提 PR / issue 让其收录。

Until npm publication, `github:kxdyh/dsh-usage-meter` and the `.tgz` release artifact are both
installable, so the GitHub release alone is a complete community release.

在尚未发布 npm 之前，`github:kxdyh/dsh-usage-meter` 和 `.tgz` 产物都可以直接安装 —— 也就是说，
**只发 GitHub 就已经是一次完整的社区发布**。

> Note: `private` was intentionally removed from the manifest so the package is publishable. The
> local install in the development profile is a `link:` to this directory, so the running plugin is
> unaffected by that change.
>
> 说明：为了可发布，清单中的 `private` 是特意去掉的。开发 profile 里的安装是指向该目录的 `link:`，
> 因此这一改动不影响正在运行的插件。
