"use client";

import { useCallback, useState } from "react";
import { useStandardWallets, useWallets } from "@privy-io/react-auth/solana";

import {
  getBurnableStealthPoolNoteScannerFunction,
  getReceiverBurnableStealthPoolNoteIntoETABurnerFunction,
  getSelfBurnableStealthPoolNoteIntoETABurnerFunction,
} from "@umbra-privacy/sdk/burn";

import {
  getBrowserUmbraClient,
  getBrowserUmbraProverSuite,
  getBrowserUmbraRelayer,
} from "@/lib/client/umbraClientSDK";
import { createUmbraSignerFromPrivyWallet } from "@/lib/client/umbraPrivySigner";
import { splitBurnableNotes } from "@/lib/umbraScanBuckets";

export type UmbraClaimStage =
  | "idle"
  | "scanning"
  | "claiming"
  | "settled"
  | "error";

interface UmbraClaimState {
  stage: UmbraClaimStage;
  claimedAmountBaseUnits: bigint;
  error: string | null;
}

export function useUmbraClaim() {
  const { wallets: standardWallets } = useStandardWallets();
  const { wallets: connectedWallets } = useWallets();
  const [state, setState] = useState<UmbraClaimState>({
    stage: "idle",
    claimedAmountBaseUnits: BigInt(0),
    error: null,
  });

  const claim = useCallback(async (): Promise<bigint> => {
    setState({
      stage: "scanning",
      claimedAmountBaseUnits: BigInt(0),
      error: null,
    });

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
      const suite = getBrowserUmbraProverSuite();

      // v5 scanner is arg-less — auto-discovers trees + resumes from store.
      const scanner = getBurnableStealthPoolNoteScannerFunction({ client });
      const scanResult = await scanner();

      // All receiver- + self-claimable notes (eta / ata / networkBalance).
      const { receiver: receiverUtxos, self: selfUtxos } =
        splitBurnableNotes(scanResult);

      let totalClaimed = BigInt(0);
      for (const u of [...receiverUtxos, ...selfUtxos]) {
        const amt = (u as any).amount;
        if (amt !== undefined) totalClaimed += BigInt(amt);
      }

      if (receiverUtxos.length === 0 && selfUtxos.length === 0) {
        throw new Error("No pending UTXOs to claim.");
      }

      setState({
        stage: "claiming",
        claimedAmountBaseUnits: totalClaimed,
        error: null,
      });

      // v5: the relayer instance exposes submitClaim/pollClaimStatus/
      // getRelayerAddress; the burner deps want them as submitBurn/
      // pollBurnStatus/getRelayerAddress. The high-level burner functions
      // own the prepare→build→submit→poll pipeline internally.
      const relayer = await getBrowserUmbraRelayer();
      const relayerDep = {
        submitBurn: relayer.submitClaim,
        pollBurnStatus: relayer.pollClaimStatus,
        getRelayerAddress: relayer.getRelayerAddress,
      };

      if (receiverUtxos.length > 0) {
        const burnReceiver = getReceiverBurnableStealthPoolNoteIntoETABurnerFunction(
          { client },
          {
            zkProver: suite.claimReceiverClaimableIntoEncryptedBalance,
            fetchBatchMerkleProof: (client as any).fetchBatchMerkleProof,
            relayer: relayerDep,
          }
        );
        await burnReceiver(receiverUtxos as any);
      }
      if (selfUtxos.length > 0) {
        const burnSelf = getSelfBurnableStealthPoolNoteIntoETABurnerFunction(
          { client },
          {
            zkProver: suite.claimSelfClaimableIntoEncryptedBalance,
            fetchBatchMerkleProof: (client as any).fetchBatchMerkleProof,
            relayer: relayerDep,
          }
        );
        await burnSelf(selfUtxos as any);
      }

      setState({
        stage: "settled",
        claimedAmountBaseUnits: totalClaimed,
        error: null,
      });
      return totalClaimed;
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
      console.error("[useUmbraClaim] error:", err);
      setState({
        stage: "error",
        claimedAmountBaseUnits: BigInt(0),
        error: parts.join("\n\n---\n\n") || err?.message || String(err),
      });
      throw err;
    }
  }, [standardWallets, connectedWallets]);

  return {
    claim,
    state,
    isLoading: state.stage === "scanning" || state.stage === "claiming",
  };
}
