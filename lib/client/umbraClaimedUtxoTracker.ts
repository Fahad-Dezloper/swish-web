"use client";

interface UtxoRef {
  treeIndex: number | bigint;
  insertionIndex: number | bigint;
}

const CACHE_TTL_MS = 30_000;
let cache: { address: string; ids: Set<string>; fetchedAt: number } | null =
  null;

function utxoId(
  treeIndex: number | bigint,
  insertionIndex: number | bigint
): string {
  return `${String(treeIndex)}:${String(insertionIndex)}`;
}

export async function fetchClaimedUtxoIds(
  address: string
): Promise<Set<string>> {
  const now = Date.now();
  if (
    cache &&
    cache.address === address &&
    now - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.ids;
  }

  try {
    const res = await fetch(
      `/api/umbra/claimed-utxos?address=${encodeURIComponent(address)}`
    );
    if (!res.ok) {
      return new Set();
    }
    const json = (await res.json()) as { ids?: string[] };
    const ids = new Set(json.ids ?? []);
    cache = { address, ids, fetchedAt: now };
    return ids;
  } catch {
    return new Set();
  }
}

export function filterUnclaimedUtxos<T extends UtxoRef>(
  claimedIds: Set<string>,
  utxos: readonly T[]
): T[] {
  if (claimedIds.size === 0) return [...utxos];
  return utxos.filter((u) => {
    if (u.treeIndex === undefined || u.insertionIndex === undefined) {
      return true;
    }
    return !claimedIds.has(utxoId(u.treeIndex, u.insertionIndex));
  });
}

export async function markUtxosClaimed<T extends UtxoRef>(
  address: string,
  utxos: readonly T[]
): Promise<void> {
  if (utxos.length === 0) return;

  const payload = utxos
    .filter(
      (u) => u.treeIndex !== undefined && u.insertionIndex !== undefined
    )
    .map((u) => ({
      treeIndex: Number(u.treeIndex),
      insertionIndex: Number(u.insertionIndex),
    }));

  if (payload.length === 0) return;

  try {
    await fetch("/api/umbra/claimed-utxos/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, utxos: payload }),
    });

    if (cache && cache.address === address) {
      for (const u of payload) {
        cache.ids.add(utxoId(u.treeIndex, u.insertionIndex));
      }
    }
  } catch (err) {
    // Don't throw — claim already succeeded on-chain. Worst case the
    // UI shows a phantom on next refresh, fixable next time the user
    // claims something else (or via the Umbra plugin once available).
    // eslint-disable-next-line no-console
    console.warn("[umbraClaimedUtxoTracker] mark failed:", err);
  }
}

export function clearTrackerCache() {
  cache = null;
}
