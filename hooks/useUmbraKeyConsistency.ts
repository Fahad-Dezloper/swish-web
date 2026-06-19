"use client";

/**
 * Umbra key-consistency verify + restore.
 *
 * v5's key-consistency check refuses to read an account whose on-chain
 * encryption keys (token-encryption X25519 + MVK X25519, and optionally the
 * user commitment) don't match the locally-derived keys. This is exactly what
 * happens to accounts registered under sdk@4.0.0 once we move to v5 — from v5's
 * POV the keys look "rotated by another application."
 *
 * The intended fix (per Cal, mirrored from Umbra's own app) is the RESTORE
 * flow, not a backcompat config:
 *   - `verifyKeyConsistency` (read-only) reports which keys mismatch.
 *   - `getRestoreKeyConsistencyFunction(...)` rewrites the account's on-chain
 *     keys to the current derivation AND re-encrypts the shielded balance to
 *     the new keys via Arcium MPC (funds-preserving by design).
 *
 * ⚠️ Restore is a real on-chain recovery op: multiple wallet-signed txs + MPC,
 * user-paid gas (no sponsorship), ~tens of seconds, and it depends on Arcium
 * MPC being healthy. One-time per existing account.
 *
 * See [[project_umbra_migration_may2026]].
 */

import { useCallback, useState } from "react";
import { useStandardWallets, useWallets } from "@privy-io/react-auth/solana";

import {
  verifyKeyConsistency,
  getRestoreKeyConsistencyFunction,
} from "@umbra-privacy/sdk/validation";
import type {
  KeyConsistencyVerificationResult,
  RestoreKeyConsistencyResult,
  RestoreKeyConsistencyHooks,
} from "@umbra-privacy/sdk/validation";

import {
  getBrowserUmbraClient,
  getBrowserUmbraProverSuite,
} from "@/lib/client/umbraClientSDK";
import { createUmbraSignerFromPrivyWallet } from "@/lib/client/umbraPrivySigner";

export type KeyConsistencyStage =
  | "idle"
  | "verifying"
  | "restoring"
  | "verified"
  | "restored"
  | "error";

interface KeyConsistencyState {
  stage: KeyConsistencyStage;
  verification: KeyConsistencyVerificationResult | null;
  restore: RestoreKeyConsistencyResult | null;
  detail: string | null;
  error: string | null;
}

const INITIAL: KeyConsistencyState = {
  stage: "idle",
  verification: null,
  restore: null,
  detail: null,
  error: null,
};

export interface RestoreKeysParams {
  /**
   * Also verify + restore the on-chain Poseidon user commitment (extra
   * anonymous-registration MPC step). Default false — token-encryption + MVK
   * cover the usual mismatch.
   */
  includeUserCommitment?: boolean;
  hooks?: RestoreKeyConsistencyHooks;
}

export function useUmbraKeyConsistency() {
  const { wallets: standardWallets } = useStandardWallets();
  const { wallets: connectedWallets } = useWallets();
  const [state, setState] = useState<KeyConsistencyState>(INITIAL);

  // Build a browser Umbra client for the currently-connected wallet. Shared by
  // both verify and restore.
  const buildClient = useCallback(async () => {
    const userAddress = connectedWallets[0]?.address;
    if (!userAddress) throw new Error("No wallet connected");

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

    return getBrowserUmbraClient({ signer, rpcUrl });
  }, [standardWallets, connectedWallets]);

  // Read-only: detect which keys are mismatched. Zero on-chain side effects.
  const verify =
    useCallback(async (): Promise<KeyConsistencyVerificationResult> => {
      setState({ ...INITIAL, stage: "verifying" });
      try {
        const client = await buildClient();
        const result = await verifyKeyConsistency({ client });
        setState((s) => ({
          ...s,
          stage: "verified",
          verification: result,
          detail: result.allConsistent
            ? "All keys consistent"
            : `Key mismatch detected (${result.mismatches.length})`,
        }));
        return result;
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("[useUmbraKeyConsistency] verify error:", err);
        setState((s) => ({
          ...s,
          stage: "error",
          error: err?.message ?? String(err),
        }));
        throw err;
      }
    }, [buildClient]);

  // ⚠️ On-chain recovery: rotates keys + re-encrypts the shielded balance.
  const restore = useCallback(
    async (params?: RestoreKeysParams): Promise<RestoreKeyConsistencyResult> => {
      setState({ ...INITIAL, stage: "restoring", detail: "Syncing keys…" });
      try {
        const client = await buildClient();
        const suite = getBrowserUmbraProverSuite();
        const restoreFn = getRestoreKeyConsistencyFunction(
          { client },
          { zkProver: suite.registration }
        );
        const result = await restoreFn({
          ...(params?.includeUserCommitment !== undefined
            ? { includeUserCommitment: params.includeUserCommitment }
            : {}),
          ...(params?.hooks ? { hooks: params.hooks } : {}),
        });
        setState((s) => ({
          ...s,
          stage: "restored",
          restore: result,
          detail: result.allRestored
            ? "Keys restored"
            : `Restored with ${result.failures.length} failure(s)`,
        }));
        return result;
      } catch (err: any) {
        const parts: string[] = [];
        let cur = err;
        while (cur) {
          if (cur.message) parts.push(cur.message);
          cur = cur.cause;
        }
        // eslint-disable-next-line no-console
        console.error("[useUmbraKeyConsistency] restore error:", err);
        setState((s) => ({
          ...s,
          stage: "error",
          error: parts.join("\n\n---\n\n") || err?.message || String(err),
        }));
        throw err;
      }
    },
    [buildClient]
  );

  return {
    verify,
    restore,
    state,
    isLoading: state.stage === "verifying" || state.stage === "restoring",
  };
}
