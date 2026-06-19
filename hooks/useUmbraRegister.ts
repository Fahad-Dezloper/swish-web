"use client";

import { useCallback, useState } from "react";
import { useStandardWallets, useWallets } from "@privy-io/react-auth/solana";

import {
  getUserAccountQuerierFunction,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";

import {
  getBrowserUmbraClient,
  getBrowserUmbraProverSuite,
} from "@/lib/client/umbraClientSDK";
import { createUmbraSignerFromPrivyWallet } from "@/lib/client/umbraPrivySigner";

export type RegisterStage =
  | "idle"
  | "checking"
  | "registering"
  | "done"
  | "already-registered"
  | "error";

interface RegisterState {
  stage: RegisterStage;
  error: string | null;
  detail: string | null;
  txSignatures: string[];
}

export function useUmbraRegister() {
  const { wallets: standardWallets } = useStandardWallets();
  const { wallets: connectedWallets } = useWallets();
  const [state, setState] = useState<RegisterState>({
    stage: "idle",
    error: null,
    detail: null,
    txSignatures: [],
  });

  const register = useCallback(async () => {
    const reset = (next: Partial<RegisterState>) =>
      setState((s) => ({ ...s, ...next }));

    reset({ stage: "checking", error: null, detail: null, txSignatures: [] });

    try {
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

      const client = await getBrowserUmbraClient({ signer, rpcUrl });

      const query = getUserAccountQuerierFunction({ client });
      const existing = await query(userAddress as any);
      if (
        existing.state === "exists" &&
        (existing.data as any).x25519PublicKey &&
        (existing.data as any).userCommitment
      ) {
        reset({
          stage: "already-registered",
          detail: "Wallet was already registered on Umbra",
        });
        return [] as string[];
      }

      const balanceRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [userAddress, { commitment: "confirmed" }],
        }),
      });
      const balanceJson = await balanceRes.json();
      const lamports: number = balanceJson?.result?.value ?? 0;
      const MIN_LAMPORTS_FOR_REGISTRATION = 50_000_000;
      if (lamports < MIN_LAMPORTS_FOR_REGISTRATION) {
        throw new Error(
          `Insufficient SOL for registration. You need at least 0.05 SOL ` +
            `(current balance: ${(lamports / 1e9).toFixed(4)} SOL). ` +
            `Registration creates on-chain accounts that require rent.`
        );
      }

      reset({
        stage: "registering",
        detail:
          "Sign each prompt to enable Umbra (one-time setup, ~4-5 prompts)",
      });

      const suite = getBrowserUmbraProverSuite();
      const registerFn = getUserRegistrationFunction(
        { client },
        { zkProver: suite.registration }
      );
      const sigs = await registerFn({
        confidential: true,
        anonymous: true,
      });

      const sigStrings = sigs.map((s) => s.toString());
      reset({
        stage: "done",
        detail: `Registered with ${sigStrings.length} txs`,
        txSignatures: sigStrings,
      });
      return sigStrings;
    } catch (err: any) {
      const parts: string[] = [];
      let cur = err;
      while (cur) {
        if (cur.message) parts.push(cur.message);
        if (cur.context?.logs) {
          parts.push("Logs:\n" + (cur.context.logs as string[]).join("\n"));
        }
        cur = cur.cause;
      }
      console.error("[useUmbraRegister] error:", err);
      reset({
        stage: "error",
        error: parts.join("\n\n---\n\n") || err?.message || String(err),
      });
      throw err;
    }
  }, [standardWallets, connectedWallets]);

  return {
    register,
    state,
    isLoading: state.stage === "checking" || state.stage === "registering",
  };
}
