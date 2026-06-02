"use client";

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createSharedBalance } from "./sharedBalance";

interface UseSOLBalanceResult {
  balance: number | null;
  balanceUSD: number | null;
  solPrice: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface SolData {
  balance: number;
  solPrice: number | null;
}

async function fetchSOLBalance(walletAddress: string): Promise<SolData> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const pubkey = new PublicKey(walletAddress);

  const [lamports, feeRes] = await Promise.all([
    connection.getBalance(pubkey),
    fetch("/api/fee")
      .then((r) => r.json())
      .catch(() => null),
  ]);

  return {
    balance: lamports / LAMPORTS_PER_SOL,
    solPrice: feeRes?.solPrice ?? null,
  };
}

// Shared cache, no polling for now (pass an interval to re-enable).
const useShared = createSharedBalance<SolData>(fetchSOLBalance);

export function useSOLBalance(
  walletAddress: string | null
): UseSOLBalanceResult {
  const { value, isLoading, error, refetch } = useShared(walletAddress);
  const balance = value?.balance ?? null;
  const solPrice = value?.solPrice ?? null;
  const balanceUSD =
    balance !== null && solPrice !== null ? balance * solPrice : null;
  return { balance, balanceUSD, solPrice, isLoading, error, refetch };
}
