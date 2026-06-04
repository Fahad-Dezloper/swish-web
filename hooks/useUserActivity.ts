"use client";

import useSWR, { mutate } from "swr";
import type { Activity, Stats } from "@/components";

interface UserData {
  activities: Activity[];
  stats: Stats;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch activity");
    return r.json();
  });

export const activityKey = (walletAddress: string) =>
  `/api/activity/user?address=${walletAddress}`;

export function useUserActivity(walletAddress: string | null | undefined) {
  const key = walletAddress ? activityKey(walletAddress) : null;

  const { data, isLoading } = useSWR<UserData>(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
    refreshInterval: 30_000,
  });

  const refetch = () => {
    if (walletAddress) mutate(activityKey(walletAddress));
  };

  return {
    activities: data?.activities ?? [],
    stats: data?.stats ?? null,
    isLoading,
    refetch,
  };
}
