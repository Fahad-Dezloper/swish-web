"use client";

import { useCallback, useState } from "react";
import { useStandardWallets, useWallets } from "@privy-io/react-auth/solana";

import { getATAIntoReceiverBurnableStealthPoolNoteCreatorFunction } from "@umbra-privacy/sdk/deposit";
import { getUserAccountQuerierFunction } from "@umbra-privacy/sdk/query";

import {
  getBrowserUmbraClient,
  getBrowserUmbraAtaDepositProver,
} from "@/lib/client/umbraClientSDK";
import { createUmbraSignerFromPrivyWallet } from "@/lib/client/umbraPrivySigner";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type UmbraSendClaimStage =
  | "idle"
  | "preparing-burner"
  | "constructing-client"
  | "checking-burner"
  | "depositing"
  | "recording"
  | "settled"
  | "error";

export interface UmbraSendClaimParams {
  amount: number;
  message?: string;
  sessionSignature: string;
  senderPublicKey: string;
}

export interface UmbraSendClaimResult {
  activityId: string;
  burnerAddress: string;
  passphrase: string;
  claimLink: string;
  createUtxoSignature: string;
  createProofAccountSignature: string;
  closeProofAccountSignature?: string;
}

interface UmbraSendClaimState {
  stage: UmbraSendClaimStage;
  error: string | null;
  detail: string | null;
}

export function useUmbraSendClaim() {
  const { wallets: standardWallets } = useStandardWallets();
  const { wallets: connectedWallets } = useWallets();
  const [state, setState] = useState<UmbraSendClaimState>({
    stage: "idle",
    error: null,
    detail: null,
  });

  const sendClaim = useCallback(
    async (params: UmbraSendClaimParams): Promise<UmbraSendClaimResult> => {
      const reset = (next: Partial<UmbraSendClaimState>) =>
        setState((s) => ({ ...s, ...next }));

      reset({ stage: "preparing-burner", error: null, detail: null });

      try {
        const prepareRes = await fetch("/api/umbra/sc/prepare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Signature": params.sessionSignature,
          },
          body: JSON.stringify({
            senderPublicKey: params.senderPublicKey,
            amount: params.amount,
            token: "USDC",
            message: params.message,
          }),
        });
        if (!prepareRes.ok) {
          const json = await prepareRes.json().catch(() => ({}));
          throw new Error(json.error || "Failed to prepare Umbra SC burner");
        }
        const { activityId, burnerAddress, passphrase } =
          (await prepareRes.json()) as {
            activityId: string;
            burnerAddress: string;
            passphrase: string;
          };

        reset({ stage: "constructing-client", detail: null });

        const userAddress = connectedWallets[0]?.address;
        if (!userAddress) throw new Error("No wallet connected");
        if (userAddress !== params.senderPublicKey) {
          throw new Error("Wallet address mismatch with session sig");
        }

        const stdWallet = standardWallets.find((w: any) =>
          w.accounts.some((a: any) => a.address === userAddress)
        );
        if (!stdWallet) {
          throw new Error("Could not find wallet-standard wallet for current user");
        }
        const stdAccount = stdWallet.accounts.find(
          (a: any) => a.address === userAddress
        );
        if (!stdAccount) {
          throw new Error("Could not find wallet-standard account");
        }
        const signer = createUmbraSignerFromPrivyWallet(stdWallet, stdAccount);

        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
        if (!rpcUrl) throw new Error("NEXT_PUBLIC_RPC_URL not set");

        const client = await getBrowserUmbraClient({ signer, rpcUrl });

        reset({ stage: "checking-burner", detail: burnerAddress });
        const query = getUserAccountQuerierFunction({ client });
        const POLL_INTERVAL_MS = 2_000;
        const POLL_TIMEOUT_MS = 30_000;
        const start = Date.now();
        let burnerReady = false;
        while (!burnerReady && Date.now() - start < POLL_TIMEOUT_MS) {
          const recipientState = await query(burnerAddress as any);
          const recipientData = (recipientState as any).data;
          burnerReady =
            recipientState.state === "exists" &&
            Boolean(
              recipientData?.x25519PublicKey && recipientData?.userCommitment
            );
          if (!burnerReady) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          }
        }
        if (!burnerReady) {
          throw new Error(
            "Burner registration didn't finalize in time. Try again in a moment."
          );
        }

        reset({
          stage: "depositing",
          detail: "Sign each prompt to complete the private send (~3 prompts)",
        });

        const deposit = getATAIntoReceiverBurnableStealthPoolNoteCreatorFunction(
          { client },
          { zkProver: getBrowserUmbraAtaDepositProver() }
        );

        const amountBaseUnits = BigInt(Math.floor(params.amount * 1_000_000));
        const result = await deposit({
          amount: amountBaseUnits as any,
          destinationAddress: burnerAddress as any,
          mint: USDC_MINT as any,
        });

        reset({ stage: "recording", detail: null });
        const recordRes = await fetch("/api/umbra/sc/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityId,
            senderPublicKey: params.senderPublicKey,
            createUtxoSignature: result.createUtxoSignature.toString(),
            // v5: populateProofAccountSignature replaces v4's create/close pair.
            createProofAccountSignature:
              result.populateProofAccountSignature.toString(),
          }),
        });
        if (!recordRes.ok) {
          const json = await recordRes.json().catch(() => ({}));
          throw new Error(
            json.error ||
              "Deposit landed on-chain but server record failed — claim link not generated"
          );
        }
        const { claimLink } = (await recordRes.json()) as {
          claimLink: string;
        };

        reset({ stage: "settled", detail: null });
        return {
          activityId,
          burnerAddress,
          passphrase,
          claimLink,
          createUtxoSignature: result.createUtxoSignature.toString(),
          createProofAccountSignature:
            result.populateProofAccountSignature.toString(),
        };
      } catch (err: any) {
        const parts: string[] = [];
        let current = err;
        while (current) {
          if (current.message) parts.push(current.message);
          if (current.context?.logs) {
            parts.push(
              "Logs:\n" + (current.context.logs as string[]).join("\n")
            );
          }
          if (current.context && Object.keys(current.context).length > 0) {
            try {
              parts.push(
                "Context: " +
                  JSON.stringify(
                    current.context,
                    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
                    2
                  )
              );
            } catch {
            }
          }
          current = current.cause;
        }
        const msg = parts.join("\n\n---\n\n");
        console.error("[useUmbraSendClaim] error:", err);
        reset({ stage: "error", error: msg || err?.message || String(err) });
        throw err;
      }
    },
    [standardWallets, connectedWallets]
  );

  return {
    sendClaim,
    state,
    isLoading:
      state.stage !== "idle" &&
      state.stage !== "settled" &&
      state.stage !== "error",
  };
}
