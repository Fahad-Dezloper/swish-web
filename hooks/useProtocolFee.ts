"use client";

import { useFee } from "./useFee";
import { estimateFee, type FeeEstimate, type FlowKind } from "@/lib/fees";
import type { ProviderId } from "@/lib/providers/types";

export function useProtocolFee(
  provider: ProviderId | "auto",
  amount: number,
  flow: FlowKind
): FeeEstimate & { isLoading: boolean } {
  const { baseFee, isLoading } = useFee();
  const estimate = estimateFee(provider, amount, flow, baseFee);
  return { ...estimate, isLoading };
}
