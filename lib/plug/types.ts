/**
 * Shared types + postMessage protocol for "the Plug" — Swish's embeddable
 * private-payments widget. Imported by the hosted /plug route, the vanilla
 * public/plug.js loader, and the @swishdotcash/plug React SDK so all three
 * speak the same contract.
 *
 * v1 = Deposit / Pay only: one recipient, one amount, USDC. Non-custodial —
 * the payer's connected wallet signs and pays its own gas (no sponsorship).
 */

/** Config the integrator supplies — passed via URL params or postMessage. */
export interface PlugConfig {
  /**
   * Destination Solana address. If set, the field is locked; if omitted, the
   * payer enters it themselves — the Plug stays open as a general private-pay
   * form. (v1 takes a raw address only; @handle resolution is a fast-follow.)
   */
  recipient?: string;
  /** Amount in `token` units. If set, the field is locked; if omitted, payer types it. */
  amount?: number;
  /** Token to send. v1 only supports USDC. */
  token?: "USDC";
  /** Integrator's order/correlation id — echoed back verbatim in onSuccess. */
  reference?: string;
  /**
   * Hosted-checkout / redirect mode: if present, on success the Plug
   * navigates the top window to `${returnUrl}?status=success&reference=...&signature=...`
   * instead of (or in addition to) posting a message. Enables mobile-webview
   * and any non-iframe surface to use the same hosted route.
   */
  returnUrl?: string;
}

/** Namespaced message channel between the iframe and the host page. */
export const PLUG_MSG = {
  /** iframe -> host: route mounted, ready to receive config. */
  READY: "swish:plug:ready",
  /** host -> iframe: config payload (alternative to URL params). */
  CONFIG: "swish:plug:config",
  /** iframe -> host: content height changed (auto-resize). */
  RESIZE: "swish:plug:resize",
  /** iframe -> host: a Privy modal opened — grow the iframe to full-screen. */
  EXPAND: "swish:plug:expand",
  /** iframe -> host: the Privy modal closed — restore the card size. */
  COLLAPSE: "swish:plug:collapse",
  /** iframe -> host: payment confirmed. */
  SUCCESS: "swish:plug:success",
  /** iframe -> host: payment failed. */
  ERROR: "swish:plug:error",
  /** iframe -> host: user dismissed the widget. */
  CLOSE: "swish:plug:close",
} as const;

export type PlugMessage =
  | { type: typeof PLUG_MSG.READY }
  | { type: typeof PLUG_MSG.CONFIG; config: PlugConfig }
  | { type: typeof PLUG_MSG.RESIZE; height: number }
  | { type: typeof PLUG_MSG.EXPAND }
  | { type: typeof PLUG_MSG.COLLAPSE }
  | { type: typeof PLUG_MSG.SUCCESS; txSignature: string; reference?: string }
  | { type: typeof PLUG_MSG.ERROR; message: string }
  | { type: typeof PLUG_MSG.CLOSE };

/**
 * Parse a PlugConfig out of URL search params (the primary, race-free path).
 * Always returns a config — every field is optional, so the Plug opens as a
 * blank private-pay form when no params are supplied.
 */
export function parsePlugConfigFromParams(params: URLSearchParams): PlugConfig {
  const amountRaw = params.get("amount");
  const amount = amountRaw != null ? Number(amountRaw) : undefined;

  return {
    recipient: params.get("recipient")?.trim() || undefined,
    amount: amount != null && Number.isFinite(amount) && amount > 0 ? amount : undefined,
    token: "USDC",
    reference: params.get("reference")?.trim() || undefined,
    returnUrl: params.get("returnUrl")?.trim() || undefined,
  };
}
