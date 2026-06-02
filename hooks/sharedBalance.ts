"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface BalanceEntry<T> {
  value: T | null;
  isLoading: boolean;
  error: string | null;
}

const EMPTY = { value: null, isLoading: false, error: null } as const;

/**
 * Builds a balance hook backed by a single shared cache keyed by wallet
 * address. All components calling the returned hook for the same address
 * share one cache entry, so:
 *  - a `refetch()` from anywhere updates everyone (instant balance after a
 *    send/withdraw, on home + profile + the account chip at once), and
 *  - one poll per address (not per component) keeps it fresh, so incoming
 *    deposits show up on their own within `pollMs`.
 */
export function createSharedBalance<T>(
  fetcher: (address: string) => Promise<T>,
  pollMs?: number
) {
  const store = new Map<string, BalanceEntry<T>>();
  const subs = new Map<string, Set<() => void>>();
  const inflight = new Map<string, Promise<void>>();
  const pollers = new Map<string, ReturnType<typeof setInterval>>();

  const snap = (a: string): BalanceEntry<T> =>
    store.get(a) ?? (EMPTY as BalanceEntry<T>);
  const emit = (a: string) => subs.get(a)?.forEach((fn) => fn());
  const patch = (a: string, p: Partial<BalanceEntry<T>>) => {
    store.set(a, { ...snap(a), ...p });
    emit(a);
  };

  function fetchFor(address: string) {
    const existing = inflight.get(address);
    if (existing) return existing;
    patch(address, { isLoading: true, error: null });
    const p = fetcher(address)
      .then((value) => patch(address, { value, isLoading: false, error: null }))
      .catch((e: { message?: string }) =>
        patch(address, {
          value: null,
          isLoading: false,
          error: e?.message ?? "Failed to fetch balance",
        })
      )
      .finally(() => inflight.delete(address));
    inflight.set(address, p);
    return p;
  }

  return function useSharedBalance(address: string | null) {
    const subscribe = useCallback(
      (cb: () => void) => {
        if (!address) return () => {};
        let set = subs.get(address);
        if (!set) {
          set = new Set();
          subs.set(address, set);
        }
        set.add(cb);
        // First subscriber for this address kicks off the fetch + poll.
        if (!store.has(address)) fetchFor(address);
        if (pollMs && !pollers.has(address)) {
          pollers.set(
            address,
            setInterval(() => {
              // Skip while the tab is hidden — no point burning RPC.
              if (
                typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              )
                return;
              fetchFor(address);
            }, pollMs)
          );
        }
        return () => {
          set!.delete(cb);
          if (set!.size === 0) {
            const t = pollers.get(address);
            if (t) {
              clearInterval(t);
              pollers.delete(address);
            }
          }
        };
      },
      [address]
    );

    const getSnapshot = useCallback(
      () => (address ? snap(address) : (EMPTY as BalanceEntry<T>)),
      [address]
    );

    const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const refetch = useCallback(() => {
      if (address) fetchFor(address);
    }, [address]);

    return { ...entry, refetch };
  };
}
