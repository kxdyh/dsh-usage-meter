/**
 * Host half of the usage meter bundle.
 *
 * The widget itself is pure Client UI: it reads the account balance through the
 * generated `remote.account` namespace and the live token/context projections
 * through the Session Controller's Client-side binding. This Host half
 * therefore only owns the plugin's lifecycle so the bundle shows up as one
 * activatable row; it registers no service of its own.
 */

/** No Host services are required; the row exists to carry the Client half. */
export const inject = [];

/**
 * Activate the Host half.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  ctx.effect(() => {
    ctx.logger?.info?.('[usage-meter] host half active (client widget owns rendering)');
  }, 'usage-meter: activation');
}
