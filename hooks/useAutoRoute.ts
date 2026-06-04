"use client";

import useSWR from "swr";
import type { ProviderId } from "@/lib/providers/types";
import type { AutoFlow } from "@/lib/router/autoRoute";

interface UseAutoRouteArgs {
  enabled: boolean;
  flow: AutoFlow;
  senderAddress: string | null;
  receiverAddress: string | null;
}

interface UseAutoRouteResult {
  resolved: ProviderId | null;
  reason: string | null;
  isLoading: boolean;
  unavailable: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("router preview failed");
    return r.json();
  });

export function useAutoRoute({
  enabled,
  flow,
  senderAddress,
  receiverAddress,
}: UseAutoRouteArgs): UseAutoRouteResult {
  const key =
    enabled && senderAddress
      ? `/api/router/preview?flow=${encodeURIComponent(flow)}` +
        `&sender=${encodeURIComponent(senderAddress)}` +
        (receiverAddress ? `&receiver=${encodeURIComponent(receiverAddress)}` : "")
      : null;

  const { data, isLoading } = useSWR<{
    providerId: ProviderId | null;
    reason: string;
    unavailable?: boolean;
  }>(key, fetcher, {
    keepPreviousData: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 2_000,
    refreshInterval: 5_000,
  });

  return {
    resolved: data?.providerId ?? null,
    reason: data?.reason ?? null,
    isLoading: !!key && isLoading,
    unavailable: !!data?.unavailable,
  };
}
