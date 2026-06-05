"use client";

/**
 * Client-side Umbra direct Send hook.
 *
 * Runs the Umbra SDK in the browser using the user's Privy embedded
 * wallet (or any wallet-standard wallet) as the IUmbraSigner. The user
 * signs each tx the SDK builds — typically 1 master-seed-consent
 * signMessage + 2 deposit signTransactions = 3 wallet prompts.
 *
 * For why we run client-side instead of server-side burner pattern,
 * see [Umbra pivot](memory/project_umbra_pivot_to_client_side.md).
 */

import { useCallback, useState } from "react";
import { useStandardWallets, useWallets } from "@privy-io/react-auth/solana";

import {
  getPublicBalanceToReceiverClaimableUtxoCreatorFunction,
  getUserAccountQuerierFunction,
} from "@umbra-privacy/sdk";
import type { ZkProverForReceiverClaimableUtxoFromPublicBalance } from "@umbra-privacy/sdk/interfaces";

import {
  getBrowserUmbraClient,
  getBrowserUmbraProverSuite,
} from "@/lib/client/umbraClientSDK";
import { createUmbraSignerFromPrivyWallet } from "@/lib/client/umbraPrivySigner";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type UmbraSendStage =
  | "idle"
  | "constructing-client"
  | "checking-recipient"
  | "depositing"
  | "recording"
  | "settled"
  | "error";

export interface UmbraSendParams {
  receiverAddress: string;
  amountBaseUnits: bigint;
  message?: string;
}

export interface UmbraSendResult {
  activityId: string | null;
  createProofAccountSignature: string;
  createUtxoSignature: string;
  closeProofAccountSignature?: string;
}

interface UmbraSendState {
  stage: UmbraSendStage;
  error: string | null;
  detail: string | null;
}

export function useUmbraSend() {
  const { wallets: standardWallets } = useStandardWallets();
  const { wallets: connectedWallets } = useWallets();
  const [state, setState] = useState<UmbraSendState>({
    stage: "idle",
    error: null,
    detail: null,
  });

  const send = useCallback(
    async (params: UmbraSendParams): Promise<UmbraSendResult> => {
      const reset = (next: Partial<UmbraSendState>) =>
        setState((s) => ({ ...s, ...next }));

      reset({ stage: "constructing-client", error: null, detail: null });

      try {
        const userAddress = connectedWallets[0]?.address;
        if (!userAddress) throw new Error("No wallet connected");

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

        const signer = createUmbraSignerFromPrivyWallet(
          stdWallet,
          stdAccount
        );

        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
        if (!rpcUrl) throw new Error("NEXT_PUBLIC_RPC_URL not set");

        const client = await getBrowserUmbraClient({ signer, rpcUrl });

        reset({ stage: "checking-recipient", detail: params.receiverAddress });
        const query = getUserAccountQuerierFunction({ client });
        const recipientState = await query(params.receiverAddress as any);
        const recipientData = (recipientState as any).data;
        const recipientFullyRegistered =
          recipientState.state === "exists" &&
          Boolean(recipientData?.x25519PublicKey && recipientData?.userCommitment);
        if (!recipientFullyRegistered) {
          throw new Error(
            "Recipient is not fully registered on Umbra. Switch to Privacy Cash or MagicBlock, or ask the recipient to finish enabling Umbra in their profile."
          );
        }

        reset({
          stage: "depositing",
          detail: "Sign each prompt to complete the private send (~3 prompts)",
        });

        const suite = getBrowserUmbraProverSuite();
        const deposit = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
          { client },
          {
            zkProver:
              suite.utxoReceiverClaimable as unknown as ZkProverForReceiverClaimableUtxoFromPublicBalance,
          }
        );

        const result = await deposit({
          amount: params.amountBaseUnits as any,
          destinationAddress: params.receiverAddress as any,
          mint: USDC_MINT as any,
        });

        reset({ stage: "recording", detail: null });
        let activityId: string | null = null;
        try {
          const recordRes = await fetch("/api/umbra/send/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senderAddress: userAddress,
              receiverAddress: params.receiverAddress,
              amountBaseUnits: params.amountBaseUnits.toString(),
              message: params.message,
              createUtxoSignature: result.createUtxoSignature.toString(),
              createProofAccountSignature: result.createProofAccountSignature.toString(),
              closeProofAccountSignature: result.closeProofAccountSignature?.toString(),
            }),
          });
          if (recordRes.ok) {
            const json = (await recordRes.json()) as { activityId: string };
            activityId = json.activityId;
          }
        } catch {}

        reset({ stage: "settled", detail: null });
        return {
          activityId,
          createProofAccountSignature: result.createProofAccountSignature.toString(),
          createUtxoSignature: result.createUtxoSignature.toString(),
          closeProofAccountSignature: result.closeProofAccountSignature?.toString(),
        };
      } catch (err: any) {
        const parts: string[] = [];
        let current = err;
        while (current) {
          if (current.message) parts.push(current.message);
          if (current.context?.logs) {
            parts.push("Logs:\n" + (current.context.logs as string[]).join("\n"));
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
            } catch {}
          }
          current = current.cause;
        }
        const msg = parts.join("\n\n---\n\n");
        reset({ stage: "error", error: msg || err?.message || String(err) });
        throw err;
      }
    },
    [standardWallets, connectedWallets]
  );

  return {
    send,
    state,
    isLoading:
      state.stage !== "idle" &&
      state.stage !== "settled" &&
      state.stage !== "error",
  };
}
