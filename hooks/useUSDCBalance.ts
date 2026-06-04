"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { createSharedBalance } from "./sharedBalance";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

interface UseUSDCBalanceResult {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

async function fetchUSDCBalance(walletAddress: string): Promise<number> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const ownerPubkey = new PublicKey(walletAddress);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    ownerPubkey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const usdcAccount = tokenAccounts.value.find(
    (account) => account.account.data.parsed.info.mint === USDC_MINT.toString()
  );

  if (!usdcAccount) return 0;
  return usdcAccount.account.data.parsed.info.tokenAmount.uiAmount || 0;
}

const useShared = createSharedBalance<number>(fetchUSDCBalance, 30_000);

export function useUSDCBalance(walletAddress: string | null): UseUSDCBalanceResult {
  const { value, isLoading, error, refetch } = useShared(walletAddress);
  return { balance: value, isLoading, error, refetch };
}
