/**
 * Per-protocol fee estimation. Pure client-side functions — caller passes
 * the amount and PC's dynamic base fee, gets back a fee in USDC.
 *
 * Per-protocol summary:
 *   PC     $0.71 base + 0.35%          (Pyth-derived base + bps)
 *   MB     0.1%                        (verified live 2026-05-14. MB charges
 *                                       it on top of the sender, but
 *                                       magicBlockProvider requests
 *                                       amount / 1.001 so the sender's debit
 *                                       == the entered amount and the fee
 *                                       comes out of what the recipient gets,
 *                                       like PC / Umbra.)
 *   Umbra  ~0.35% send + ~0.35% unshield (two legs; measured on-chain
 *                                       2026-06-11. SDK = 35bps protocol +
 *                                       35bps relayer, fired on DIFFERENT legs.
 *                                       Direct send/fulfill: 0.35% at send +
 *                                       0.35% at unshield. SC: full 0.7% at
 *                                       claim, no separate unshield.)
 */

import type { ProviderId } from "./providers/types";

export interface FeeEstimate {
  feeUSDC: number;
  breakdown: string;
}

export type FlowKind = "send" | "fulfill" | "send_claim";

// PC: dynamic base ($0.71-ish via Pyth) + 0.35% bps
export function estimatePcFee(
  amount: number,
  baseFeeUSDC: number
): FeeEstimate {
  const bpsFee = amount * 0.0035;
  return {
    feeUSDC: baseFeeUSDC + bpsFee,
    breakdown: `${baseFeeUSDC.toFixed(2)} USDC base + 0.35%`,
  };
}

// MB: 0.1%. MB charges it on top of the sender, but magicBlockProvider
// requests amount / 1.001 so the sender's debit equals the entered amount —
// the fee effectively comes out of what the recipient receives. The displayed
// fee is therefore amount - amount/1.001 (≈ 0.0999% of the amount).
export function estimateMbFee(amount: number): FeeEstimate {
  return {
    feeUSDC: amount - amount / 1.001,
    breakdown: "0.1%",
  };
}

// Umbra charges ~0.35% on the send/deposit leg AND ~0.35% on the unshield/claim
// leg — two separate on-chain fees, not one. Measured on-chain 2026-06-11: $1
// direct send → 0.996521 note (send leg), then unshield → 0.993055 landed
// (unshield leg); ~0.695% round-trip.
//
// Per flow:
//   - Direct Send / Request fulfill: recipient lands a shielded note → we
//     surface only the SEND leg here; the recipient pays the unshield leg later
//     (UnlockModal, which reuses UMBRA_FEE_RATE).
//   - Send & Claim: the burner claims + unshields straight to the recipient
//     (no separate unshield step), so both legs land at claim → full ~0.7%.
export const UMBRA_FEE_RATE = 0.0035; // per leg

export function estimateUmbraFee(amount: number, flow: FlowKind): FeeEstimate {
  if (flow === "send_claim") {
    return { feeUSDC: amount * UMBRA_FEE_RATE * 2, breakdown: "0.7%" };
  }
  return { feeUSDC: amount * UMBRA_FEE_RATE, breakdown: "0.35%" };
}

/**
 * Resolve the fee for a given protocol + flow + amount. PC requires the
 * current Pyth-derived base fee (caller fetches via useFee).
 *
 * For provider="auto" (no specific protocol picked yet — typically before
 * a receiver is entered), shows MB. With no receiver, Umbra is ineligible
 * and the router picks MB if live; PC is only the fallback-of-fallback if
 * MB is down.
 */
export function estimateFee(
  provider: ProviderId | "auto",
  amount: number,
  flow: FlowKind,
  pcBaseFeeUSDC: number
): FeeEstimate {
  switch (provider) {
    case "privacy-cash":
      return estimatePcFee(amount, pcBaseFeeUSDC);
    case "magicblock-per":
    case "auto":
      return estimateMbFee(amount);
    case "umbra":
      return estimateUmbraFee(amount, flow);
  }
}
