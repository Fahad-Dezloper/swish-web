"use client";

/**
 * Read the user's Umbra "shielded" balance — sum of:
 *   1. Decrypted encrypted-balance amount (already-claimed funds)
 *   2. Filtered pending UTXOs (receiver-claimable + self-claimable that
 *      haven't been claimed yet, per our localStorage tracker)
 *
 * The localStorage tracker filters out already-claimed leaves that the
 * SDK scanner still returns (Umbra doesn't filter nullified UTXOs at
 * the scanner level — they're shipping a plugin for this in an upcoming
 * release; until then, dapps track their own).
 *
 * UI exposes a single `totalUSDC` for display. The `Unlock` flow uses
 * this hook's filtered result to drive claim+withdraw sequencing.
 */

import { useCallback, useEffect, useState } from "react";
import { useStandardWallets, useWallets } from "@privy-io/react-auth/solana";

import { isKeyConsistencyError } from "@umbra-privacy/sdk";
import { getBurnableStealthPoolNoteScannerFunction } from "@umbra-privacy/sdk/burn";
import { getEncryptedBalanceQuerierFunction } from "@umbra-privacy/sdk/query";

import {
  getBrowserUmbraClient,
  hasStoredMasterSeed,
} from "@/lib/client/umbraClientSDK";
import { createUmbraSignerFromPrivyWallet } from "@/lib/client/umbraPrivySigner";
import {
  fetchClaimedUtxoIds,
  filterUnclaimedUtxos,
} from "@/lib/client/umbraClaimedUtxoTracker";
import { splitBurnableNotes } from "@/lib/umbraScanBuckets";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type UmbraBalanceStatus =
  | "idle"
  | "needs-reveal"
  | "loading"
  | "ready"
  | "no-wallet"
  | "error";

interface UmbraBalanceState {
  status: UmbraBalanceStatus;
  encryptedBaseUnits: bigint;
  pendingBaseUnits: bigint;
  totalBaseUnits: bigint;
  totalUSDC: number;
  hasPending: boolean;
  error: string | null;
  // True when the read failed because the account's on-chain encryption keys
  // don't match the v5-derived keys (pre-migration sdk@4.0.0 account). The UI
  // surfaces a one-time "sync keys" (restore) action in this case.
  needsKeyRestore: boolean;
}

const ZERO_STATE: UmbraBalanceState = {
  status: "idle",
  encryptedBaseUnits: BigInt(0),
  pendingBaseUnits: BigInt(0),
  totalBaseUnits: BigInt(0),
  totalUSDC: 0,
  hasPending: false,
  error: null,
  needsKeyRestore: false,
};

export function useUmbraBalance(autoFetch = false) {
  const { wallets: standardWallets } = useStandardWallets();
  const { wallets: connectedWallets } = useWallets();
  const [state, setState] = useState<UmbraBalanceState>(ZERO_STATE);

  const fetchBalance = useCallback(async () => {
    const userAddress = connectedWallets[0]?.address;
    if (!userAddress) {
      setState({ ...ZERO_STATE, status: "no-wallet" });
      return;
    }

    setState((s) => ({ ...s, status: "loading", error: null }));

    try {
      const stdWallet = standardWallets.find((w: any) =>
        w.accounts.some((a: any) => a.address === userAddress)
      );
      if (!stdWallet) throw new Error("No wallet-standard wallet found");
      const stdAccount = stdWallet.accounts.find(
        (a: any) => a.address === userAddress
      );
      if (!stdAccount) throw new Error("No wallet-standard account found");

      const signer = createUmbraSignerFromPrivyWallet(stdWallet, stdAccount);
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
      if (!rpcUrl) throw new Error("NEXT_PUBLIC_RPC_URL not set");

      const client = await getBrowserUmbraClient({ signer, rpcUrl });

      // Prime the master seed by running one SDK call first. Both the
      // encrypted-balance querier AND the scanner need the master seed;
      // running them in Promise.all races — both check the empty cache
      // simultaneously, both prompt the user. After this first call,
      // master seed is cached in sessionStorage and subsequent calls
      // reuse it without prompting.
      const balanceMap = await getEncryptedBalanceQuerierFunction({
        client,
      })([USDC_MINT as any]);

      // Now safe to parallelize. Scanner reuses the cached master seed;
      // tracker fetch is unrelated to Umbra crypto. v5 scanner is arg-less —
      // it auto-discovers trees and resumes from the scan-progress store.
      const [scanResult, claimedIds] = await Promise.all([
        getBurnableStealthPoolNoteScannerFunction({ client })(),
        fetchClaimedUtxoIds(userAddress),
      ]);

      // Encrypted balance: extract USDC amount if available + decryptable.
      let encryptedBaseUnits = BigInt(0);
      const usdcResult = balanceMap.get(USDC_MINT as any);
      if (usdcResult && (usdcResult as any).state === "shared") {
        encryptedBaseUnits = (usdcResult as any).balance as bigint;
      }

      // Pending UTXOs: all receiver- + self-claimable notes (across eta / ata /
      // networkBalance sources), AFTER filtering out already-claimed leaves
      // (server-tracked).
      const { receiver, self } = splitBurnableNotes(scanResult);
      const pendingBuckets = filterUnclaimedUtxos(claimedIds, [
        ...receiver,
        ...self,
      ]);
      let pendingBaseUnits = BigInt(0);
      for (const utxo of pendingBuckets) {
        const amt = (utxo as any).amount;
        if (amt !== undefined) {
          pendingBaseUnits += BigInt(amt);
        }
      }

      const totalBaseUnits = encryptedBaseUnits + pendingBaseUnits;

      setState({
        status: "ready",
        encryptedBaseUnits,
        pendingBaseUnits,
        totalBaseUnits,
        totalUSDC: Number(totalBaseUnits) / 1_000_000,
        hasPending: pendingBaseUnits > BigInt(0),
        error: null,
        needsKeyRestore: false,
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[useUmbraBalance] error:", err);
      const needsKeyRestore = isKeyConsistencyError(err);
      setState({
        ...ZERO_STATE,
        status: "error",
        error: needsKeyRestore
          ? "Your Umbra keys need a one-time sync before your shielded balance can be read."
          : err?.message ?? String(err),
        needsKeyRestore,
      });
    }
  }, [standardWallets, connectedWallets]);

  useEffect(() => {
    if (!autoFetch) return;
    const userAddress = connectedWallets[0]?.address;
    if (!userAddress) {
      setState({ ...ZERO_STATE, status: "no-wallet" });
      return;
    }
    // Only auto-fetch silently if master seed is already cached. Otherwise
    // wait for the user to click "Reveal" so we don't surprise them with a
    // wallet popup on profile load.
    if (hasStoredMasterSeed(userAddress)) {
      fetchBalance();
    } else {
      setState({ ...ZERO_STATE, status: "needs-reveal" });
    }
  }, [autoFetch, fetchBalance, connectedWallets]);

  return {
    ...state,
    refetch: fetchBalance,
  };
}
