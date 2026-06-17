/**
 * Wire protocol for the Plug iframe <-> host bridge. Kept self-contained
 * (no imports) so the published package has zero runtime dependencies and
 * stays in lockstep with the hosted route's lib/plug/types.ts.
 */

export const PLUG_MSG = {
  READY: "swish:plug:ready",
  CONFIG: "swish:plug:config",
  RESIZE: "swish:plug:resize",
  EXPAND: "swish:plug:expand",
  COLLAPSE: "swish:plug:collapse",
  SUCCESS: "swish:plug:success",
  ERROR: "swish:plug:error",
  CLOSE: "swish:plug:close",
} as const;

export interface PlugProps {
  /**
   * Destination: a Solana address OR a Swish @handle. Optional — omit it and
   * the Plug opens as a private-pay form where the payer enters the recipient.
   */
  recipient?: string;
  /** Amount in USDC. If set, the field is locked; omit to let the payer type it. */
  amount?: number;
  /** Token to send. v1 supports USDC only. */
  token?: "USDC";
  /**
   * Optional. Your own order/correlation id (an order number, invoice id,
   * cart id — whatever you already use). The Plug never reads or stores it;
   * it's echoed back untouched in onSuccess so you can match the payment to
   * your order. Omit it entirely if you have no order to track.
   */
  reference?: string;
  /** Origin of the hosted Plug. Defaults to https://plug.swish.cash. */
  baseUrl?: string;
  /** Override the trigger-button text. Defaults to "Deposit Privately". */
  label?: string;
  /** Force the compact "Deposit" label. If unset, auto-shrinks when cramped. */
  compact?: boolean;
  /** Custom trigger element. If provided, replaces the default branded button. */
  children?: React.ReactNode;
  /** Fired when the payment confirms. */
  onSuccess?: (txSignature: string, reference?: string) => void;
  /** Fired on a failed payment (the widget stays open for retry). */
  onError?: (message: string) => void;
  /** Fired when the user dismisses the widget. */
  onClose?: () => void;
  /** Extra className for the iframe wrapper. */
  className?: string;
  /** Inline style for the iframe wrapper. */
  style?: React.CSSProperties;
}
