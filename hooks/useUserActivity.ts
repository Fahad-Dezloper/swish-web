"use client";

import { useCallback, useEffect, useState } from "react";
import type { Activity, Stats } from "@/components";

interface UserData {
  activities: Activity[];
  stats: Stats;
}

/**
 * Fetches the signed-in user's activity + stats from
 * `GET /api/activity/user?address=`. Shared by the home recent-activity
 * preview and the Profile activity tab.
 */
export function useUserActivity(walletAddress: string | null | undefined) {
  const [data, setData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/activity/user?address=${walletAddress}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Error fetching user activity:", error);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) refetch();
  }, [walletAddress, refetch]);

  return {
    activities: data?.activities ?? [],
    stats: data?.stats ?? null,
    isLoading,
    refetch,
  };
}
