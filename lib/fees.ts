import type { ProviderId } from "./providers/types";

export interface FeeEstimate {
  feeUSDC: number;
  breakdown: string;
}

export type FlowKind = "send" | "fulfill" | "send_claim";

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

export function estimateMbFee(amount: number): FeeEstimate {
  return {
    feeUSDC: amount - amount / 1.001,
    breakdown: "0.1%",
  };
}

export function estimateUmbraFee(amount: number, _flow: FlowKind): FeeEstimate {
  const fee = amount * 0.007;
  return {
    feeUSDC: fee,
    breakdown: "0.7% on claim",
  };
}

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
