/**
 * Client half of the usage meter.
 *
 * Registers one widget into the sidebar-foot action list (`sidebar.footer.action`,
 * declared by `@deepseek-ai/dsh-client-ui-sidebar`), so it renders directly above
 * the Settings row / account launcher.
 *
 * Data sources, all live and already computed by the Host:
 *  - token + context occupancy: the `contextPressure` and `tokenUsage` Session
 *    projections, read through the Session Controller's Client-side `binding()`;
 *  - account balance: the generated `remote.account` namespace (`getBalance`,
 *    plus `watch` for login-state changes).
 *
 * No Harness Client package is imported: React arrives from the page's platform
 * module table and styling uses `--dsw-alias-*` theme tokens only.
 */
window.__ModuleLoader__.load({
  id: '@kxdyh/dsh-usage-meter',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useSyncExternalStore } = React;

    const CSS_TAG = '@kxdyh/dsh-usage-meter/meter.css';
    // Styling follows the host: only --dsw-alias-* theme tokens, sidebar row
    // metrics, and tabular figures so the numbers do not jitter as they tick.
    const CSS = [
      '.lum-root{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;padding:0 2px 4px}',
      '.lum-rail{flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:2px 0 6px}',
      '.lum-trigger{box-sizing:border-box;display:flex;flex-direction:column;gap:4px;width:100%;min-width:0;padding:5px 8px;border:0;border-radius:var(--dsw-radius-sm,6px);background:0 0;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.lum-trigger:hover,.lum-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.lum-detail{box-sizing:border-box;display:flex;flex-direction:column;gap:3px;width:100%;min-width:0;padding:4px 8px 2px}',
      '.lum-line{display:flex;align-items:baseline;gap:6px;min-width:0}',
      '.lum-label{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;flex:none;white-space:nowrap}',
      '.lum-value{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lum-percent{color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;font-weight:500;font-variant-numeric:tabular-nums;flex:none}',
      '.lum-track{height:3px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden;flex:none}',
      '.lum-fill{height:100%;border-radius:999px;background:var(--dsw-alias-label-tertiary);transition:width .3s ease}',
      '.lum-fill-warn{background:var(--dsw-alias-label-warning,#d9a441)}',
      '.lum-fill-hot{background:var(--dsw-alias-label-error,#e5484d)}',
      '.lum-muted{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:15px}',
      '.lum-ring{width:18px;height:18px;display:block}',
      '.lum-ring-track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2px}',
      '.lum-ring-fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2px;stroke-linecap:round}',
      '.lum-rail-value{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:12px;font-variant-numeric:tabular-nums;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    ].join('');

    /** Compact count formatter matching the host's own context meter. */
    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      const scaled = (c) => (c >= 100 ? String(Math.round(c)) : String(Math.round(c * 10) / 10));
      if (value < 1000) return String(value);
      if (value < 1e6) return `${scaled(value / 1e3)}K`;
      return `${scaled(value / 1e6)}M`;
    }

    /** Fractional digits the balance display keeps — the platform reports
     * sub-cent amounts, and this is the precision the widget promises. */
    const MONEY_MAX_DECIMALS = 7;
    /** Cents are always shown, even when the platform reports a coarser value. */
    const MONEY_MIN_DECIMALS = 2;

    /**
     * Currency formatter for a wallet pair reported by the platform. `balance`
     * is a decimal STRING that may be negative or sub-cent, so it is formatted
     * as text — never coerced through a float, which would round it — keeping
     * the platform's precision down to {@link MONEY_MAX_DECIMALS} decimal places.
     */
    function formatMoney(currency, balance) {
      const symbol = currency === 'CNY' ? '\u00a5' : '$';
      const raw = typeof balance === 'string' ? balance.trim() : String(balance ?? '');
      if (raw === '' || raw === '—') return `${symbol}—`;
      if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return `${symbol}${raw}`;
      const negative = raw.startsWith('-');
      const body = negative ? raw.slice(1) : raw;
      const dot = body.indexOf('.');
      const whole = dot === -1 ? body : body.slice(0, dot);
      const reported = dot === -1 ? '' : body.slice(dot + 1);
      // Keep what the platform reported, up to the documented precision.
      const capped = reported.slice(0, MONEY_MAX_DECIMALS);
      // Trailing zeros are noise, but cents are not: never drop below the floor.
      const trimmed = capped.replace(/0+$/, '');
      const frac =
        trimmed.length >= MONEY_MIN_DECIMALS ? trimmed : reported.padEnd(MONEY_MIN_DECIMALS, '0').slice(0, MONEY_MIN_DECIMALS);
      return `${symbol}${negative ? '-' : ''}${whole}.${frac}`;
    }

    /** Minimal observable store so plain React can subscribe without host primitives. */
    function createStore(initial) {
      let snapshot = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(next) {
          snapshot = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }

    const EMPTY_USAGE = { pressure: undefined, usage: undefined };
    const EMPTY_BALANCE = { phase: 'idle', wallets: [], bonusWallets: [], error: undefined };

    /**
     * Live projection bridge for one Session id.
     * Subscribes to the Session Controller's retained binding and mirrors the
     * `contextPressure` / `tokenUsage` projection faces into one stable snapshot.
     */
    function createSessionUsageBridge(ctx) {
      const store = createStore(EMPTY_USAGE);
      let currentId;
      let binding;
      let disposers = [];
      let retryTimer;

      const publish = () => {
        if (binding === undefined) {
          store.set(EMPTY_USAGE);
          return;
        }
        const projections = binding.session?.projections;
        if (projections === undefined) {
          store.set(EMPTY_USAGE);
          return;
        }
        // Read through the identity-stable faces: the store's public read path.
        const value = {};
        try {
          value.pressure = projections.faceOf('contextPressure').getSnapshot();
        } catch {
          value.pressure = undefined;
        }
        try {
          value.usage = projections.faceOf('tokenUsage').getSnapshot();
        } catch {
          value.usage = undefined;
        }
        store.set(value);
      };

      const detach = () => {
        for (const dispose of disposers.splice(0)) {
          try {
            dispose();
          } catch {
            /* a released face must not break the meter */
          }
        }
        binding = undefined;
      };

      const attach = (sessionId) => {
        let candidate;
        try {
          candidate = ctx.sessions?.binding?.(sessionId);
        } catch {
          candidate = undefined;
        }
        if (candidate === undefined) {
          binding = undefined;
          // The Conversation panel retains its Session asynchronously; retry
          // cheaply until that retained binding exists. No reference is taken.
          if (retryTimer === undefined) {
            retryTimer = setTimeout(() => {
              retryTimer = undefined;
              if (currentId === sessionId) attach(currentId);
            }, 1000);
          }
          publish();
          return;
        }
        binding = candidate;
        const projections = candidate.session?.projections;
        if (projections !== undefined) {
          for (const key of ['contextPressure', 'tokenUsage']) {
            try {
              disposers.push(projections.faceOf(key).subscribe(publish));
            } catch {
              /* projection faces are best-effort */
            }
          }
        }
        publish();
      };

      return {
        // Store-like surface: the widget binds these through useSyncExternalStore.
        subscribe: (listener) => store.subscribe(listener),
        getSnapshot: () => store.getSnapshot(),
        select(sessionId) {
          if (sessionId === currentId) return;
          currentId = sessionId;
          detach();
          if (retryTimer !== undefined) {
            clearTimeout(retryTimer);
            retryTimer = undefined;
          }
          if (sessionId === undefined || sessionId === null || sessionId === '') {
            publish();
            return;
          }
          attach(sessionId);
        },
        dispose() {
          if (retryTimer !== undefined) clearTimeout(retryTimer);
          retryTimer = undefined;
          currentId = undefined;
          detach();
        },
      };
    }

    /**
     * Account balance controller: one `watch` subscription for login state plus a
     * short refresh on login and on a slow poll (balance has no push channel).
     */
    function createBalanceController(ctx, locale) {
      const store = createStore(EMPTY_BALANCE);
      let disposers = [];
      let pollTimer;
      let inFlight;
      let revision = 0;

      /** Client identity the account Remote methods carry, read at call time. */
      const metadata = () => ({
        version: '0.2.0-rc.2',
        locale: (() => {
          try {
            return locale.getSnapshot().active;
          } catch {
            return 'en';
          }
        })(),
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      });

      const read = async () => {
        const generation = revision;
        if (inFlight !== undefined) return inFlight;
        const request = (async () => {
          try {
            const result = await ctx.remote.account.getBalance(metadata());
            if (generation !== revision) return;
            if (!result || result.ok !== true) {
              store.set({ ...store.getSnapshot(), phase: 'failed', error: 'request-failed' });
              return;
            }
            const value = result.value;
            if (value === null || value === undefined) {
              store.set({ phase: 'signed-out', wallets: [], bonusWallets: [] });
              return;
            }
            if (value.status === 'failed') {
              store.set({ ...store.getSnapshot(), phase: 'failed', error: 'platform-failed' });
              return;
            }
            store.set({
              phase: 'ready',
              wallets: Array.isArray(value.value) ? value.value : [],
              bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
            });
          } catch (error) {
            if (generation !== revision) return;
            store.set({ ...store.getSnapshot(), phase: 'failed', error: 'disconnected' });
          }
        })();
        inFlight = request;
        try {
          return await request;
        } finally {
          if (inFlight === request) inFlight = undefined;
        }
      };

      const start = () => {
        revision += 1;
        // Slow poll: the balance changes out of band (top-ups, other devices).
        pollTimer = setInterval(() => {
          void read();
        }, 60_000);
      };

      const stop = () => {
        revision += 1;
        if (pollTimer !== undefined) clearInterval(pollTimer);
        pollTimer = undefined;
      };

      return {
        store,
        refresh: read,
        start() {
          let stream;
          try {
            stream = ctx.remote.$stream({
              name: 'account',
              open: (signal) => ctx.remote.account.watch(signal),
              ended: () => new Error('account stream ended'),
            });
          } catch {
            store.set({ ...store.getSnapshot(), phase: 'failed', error: 'no-account-service' });
            return;
          }
          disposers.push(() => stream.dispose());
          // The watch stream only announces login-state CHANGES; a page that was
          // already signed in when this plugin mounted would otherwise wait
          // forever for its first balance. One unconditional initial read costs a
          // single Remote call and resolves that case.
          void read();
          void (async () => {
            try {
              for await (const frame of stream) {
                const value = frame?.value;
                if (value?.status === 'credential-stored') {
                  stop();
                  start();
                  void read();
                } else {
                  stop();
                  revision += 1;
                  store.set({ phase: 'signed-out', wallets: [], bonusWallets: [] });
                }
                try {
                  frame?.accept?.();
                } catch {
                  /* accepting a frame is advisory */
                }
              }
            } catch {
              store.set({ ...store.getSnapshot(), phase: 'failed', error: 'disconnected' });
            }
          })();
        },
        dispose() {
          stop();
          for (const dispose of disposers.splice(0)) {
            try {
              dispose();
            } catch {
              /* ignore teardown faults */
            }
          }
        },
      };
    }

    /** Ring gauge used when the sidebar is collapsed to its 56px rail. */
    function Ring(props) {
      const percent = typeof props.percent === 'number' ? Math.max(0, Math.min(100, props.percent)) : 0;
      const radius = 7;
      const circumference = 2 * Math.PI * radius;
      return h(
        'svg',
        { className: 'lum-ring', viewBox: '0 0 18 18', 'aria-hidden': 'true' },
        h('circle', { className: 'lum-ring-track', cx: 9, cy: 9, r: radius }),
        h('circle', {
          className: 'lum-ring-fill',
          cx: 9,
          cy: 9,
          r: radius,
          strokeDasharray: `${(circumference * percent) / 100} ${circumference}`,
          transform: 'rotate(-90 9 9)',
        }),
      );
    }

    /**
     * The sidebar-foot widget.
     * @param props - owner props (`wide`) plus the standard `useSessions` hook and
     * the business inject (`usage`, `balance`, `t`).
     */
    function UsageMeter(props) {
      const { wide, useSessions, usage, balance, t } = props;

      // Select only the active conversation's identity; the store does the rest.
      const sessionId = useSessions((state) => {
        const rows = state?.byId ?? {};
        for (const id of Object.keys(rows)) {
          if ((rows[id]?.retainedBy?.mainView ?? 0) > 0) return id;
        }
        return state?.ids?.[0];
      });

      const usageSnapshot = useSyncExternalStore(usage.subscribe, usage.getSnapshot, usage.getSnapshot);
      const balanceSnapshot = useSyncExternalStore(balance.subscribe, balance.getSnapshot, balance.getSnapshot);
      useEffect(() => {
        usage.select(sessionId);
      }, [sessionId, usage]);

      const [open, setOpen] = useState(false);
      const pressure = usageSnapshot.pressure;
      const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens;
      const contextWindow = pressure?.contextWindow;
      const percent =
        typeof usedTokens === 'number' && typeof contextWindow === 'number' && contextWindow > 0
          ? Math.min(100, Math.round((usedTokens / contextWindow) * 100))
          : undefined;

      // Prefer the CNY wallet, then USD, then the first reported — the arrays
      // carry one entry per currency, not a fixed order.
      const wallets = balanceSnapshot.wallets ?? [];
      const wallet =
        wallets.find((entry) => entry.currency === 'CNY') ??
        wallets.find((entry) => entry.currency === 'USD') ??
        wallets[0];
      const balanceText =
        balanceSnapshot.phase === 'ready' && wallet !== undefined
          ? formatMoney(wallet.currency, wallet.balance)
          : undefined;

      const usageText =
        percent === undefined ? t('usage.unknown') : `${formatTokens(usedTokens)} / ${formatTokens(contextWindow)}`;

      if (!wide) {
        return h(
          'div',
          { className: 'lum-rail', title: `${t('title.usage')}: ${usageText}` },
          h(Ring, { percent }),
          balanceText !== undefined ? h('span', { className: 'lum-rail-value' }, balanceText) : null,
        );
      }

      const fillClass =
        percent === undefined ? 'lum-fill' : percent >= 90 ? 'lum-fill lum-fill-hot' : percent >= 70 ? 'lum-fill lum-fill-warn' : 'lum-fill';

      return h(
        'div',
        { className: 'lum-root' },
        h(
          'button',
          {
            type: 'button',
            className: 'lum-trigger',
            'aria-expanded': open,
            title: t('title.expand'),
            onClick: () => setOpen((value) => !value),
          },
          h(
            'span',
            { className: 'lum-line' },
            h('span', { className: 'lum-label' }, t('label.context')),
            h('span', { className: 'lum-percent' }, percent === undefined ? '—' : `${percent}%`),
            h('span', { className: 'lum-value' }, usageText),
          ),
          h('span', { className: 'lum-track' }, h('span', { className: fillClass, style: { width: `${percent ?? 0}%` } })),
          h(
            'span',
            { className: 'lum-line' },
            h('span', { className: 'lum-label' }, t('label.balance')),
            h(
              'span',
              { className: 'lum-value' },
              balanceText ??
                (balanceSnapshot.phase === 'signed-out'
                  ? t('balance.signedOut')
                  : balanceSnapshot.phase === 'failed'
                    ? t('balance.unavailable')
                    : t('balance.loading')),
            ),
          ),
        ),
        open
          ? h(
              'div',
              { className: 'lum-detail' },
              h(
                'span',
                { className: 'lum-line' },
                h('span', { className: 'lum-label' }, t('detail.input')),
                h('span', { className: 'lum-value' }, formatTokens(usageSnapshot.usage?.uncachedInputTokens)),
              ),
              h(
                'span',
                { className: 'lum-line' },
                h('span', { className: 'lum-label' }, t('detail.output')),
                h('span', { className: 'lum-value' }, formatTokens(usageSnapshot.usage?.outputTokens)),
              ),
              h(
                'span',
                { className: 'lum-line' },
                h('span', { className: 'lum-label' }, t('detail.cacheRead')),
                h('span', { className: 'lum-value' }, formatTokens(usageSnapshot.usage?.cacheReadTokens)),
              ),
              h(
                'span',
                { className: 'lum-line' },
                h('span', { className: 'lum-label' }, t('detail.cacheWrite')),
                h('span', { className: 'lum-value' }, formatTokens(usageSnapshot.usage?.cacheWriteTokens)),
              ),
              (balanceSnapshot.bonusWallets ?? []).map((entry, index) =>
                h(
                  'span',
                  { className: 'lum-line', key: `bonus-${index}` },
                  h('span', { className: 'lum-label' }, t('detail.bonus')),
                  h('span', { className: 'lum-value' }, formatMoney(entry.currency, entry.balance)),
                ),
              ),
              h('span', { className: 'lum-muted' }, t('detail.note')),
            )
          : null,
      );
    }

    const DICTIONARIES = {
      zh: {
        'title.usage': '实时用量与余额',
        'title.expand': '展开用量明细',
        'label.context': '上下文',
        'label.balance': '余额',
        'usage.unknown': '等待用量数据',
        'balance.loading': '读取中…',
        'balance.signedOut': '未登录',
        'balance.unavailable': '暂不可用',
        'detail.input': '输入 tokens',
        'detail.output': '输出 tokens',
        'detail.cacheRead': '缓存读取',
        'detail.cacheWrite': '缓存写入',
        'detail.bonus': '赠送余额',
        'detail.note': '上下文用量来自 contextPressure 投影；余额来自账户服务。',
      },
      en: {
        'title.usage': 'Live usage and balance',
        'title.expand': 'Expand usage details',
        'label.context': 'Context',
        'label.balance': 'Balance',
        'usage.unknown': 'Waiting for usage',
        'balance.loading': 'Loading…',
        'balance.signedOut': 'Not signed in',
        'balance.unavailable': 'Unavailable',
        'detail.input': 'Input tokens',
        'detail.output': 'Output tokens',
        'detail.cacheRead': 'Cache read',
        'detail.cacheWrite': 'Cache write',
        'detail.bonus': 'Bonus balance',
        'detail.note': 'Context usage comes from the contextPressure projection; balance from the account service.',
      },
    };

    const NS = 'usage-meter';

    return {
      name: '@kxdyh/dsh-usage-meter',
      // `remote.account` orders this plugin after the account Remote namespace
      // exists; `sessions` provides the Client Session bindings the projection
      // bridge borrows from.
      inject: ['slots', 'locale', 'remote', 'remote.account', 'sessions'],
      apply(ctx) {
        // Localized text is routed through the Client locale service, so the
        // widget follows the active language without re-registering.
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'usage-meter: dictionaries');
        const t = ctx.locale.bind(NS);

        // One stylesheet, owned by this plugin's effect lifetime.
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.plugin = '@kxdyh/dsh-usage-meter';
          style.dataset.pluginCss = CSS_TAG;
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => {
            style.remove();
          };
        }, 'usage-meter: stylesheet');

        const usage = createSessionUsageBridge(ctx);
        const balance = createBalanceController(ctx, ctx.locale);

        ctx.effect(() => () => usage.dispose(), 'usage-meter: projection bridge');
        ctx.effect(() => {
          balance.start();
          return () => balance.dispose();
        }, 'usage-meter: account controller');

        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'usage-meter',
              order: 50,
              label: () => t('title.usage'),
              inject: () => ({
                usage,
                balance: balance.store,
                t,
              }),
            },
            UsageMeter,
          ),
        );
      },
    };
  },
});
