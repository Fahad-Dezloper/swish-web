"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import { useCallback, useEffect, useState } from "react";

import type { ProviderId } from "@/lib/providers/types";
import {
  PC_SESSION_MESSAGE,
  MB_SESSION_MESSAGE,
  UMBRA_SESSION_MESSAGE,
  REQUEST_SESSION_MESSAGE,
} from "@/lib/session-messages";

export type SessionContext = ProviderId | "request";

const SESSION_CONFIGS = {
  "privacy-cash": {
    message: PC_SESSION_MESSAGE,
    signatureKey: "pc_session_signature",
    addressKey: "pc_session_address",
  },
  "magicblock-per": {
    message: MB_SESSION_MESSAGE,
    signatureKey: "mb_session_signature",
    addressKey: "mb_session_address",
  },
  umbra: {
    message: UMBRA_SESSION_MESSAGE,
    signatureKey: "umbra_session_signature",
    addressKey: "umbra_session_address",
  },
  request: {
    message: REQUEST_SESSION_MESSAGE,
    signatureKey: "request_session_signature",
    addressKey: "request_session_address",
  },
} as const satisfies Record<
  SessionContext,
  { message: string; signatureKey: string; addressKey: string }
>;

interface SessionSignatureState {
  signature: string | null;
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

export type SessionSignatureResult = {
  signature: string;
  address: string;
};

export type GetSessionSignature = () => Promise<SessionSignatureResult | null>;

export function useSessionSignature(provider: SessionContext = "privacy-cash") {
  const config = SESSION_CONFIGS[provider];
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();

  const [state, setState] = useState<SessionSignatureState>({
    signature: null,
    address: null,
    isLoading: true,
    error: null,
  });

  const isTwitterUser = !!user?.twitter;
  const userWalletAddress = user?.wallet?.address;
  const embeddedWallet = wallets.find(
    (w) =>
      (w as any).walletClientType === "privy" ||
      (userWalletAddress && w.address === userWalletAddress)
  );
  const solanaWallet = isTwitterUser
    ? embeddedWallet || null
    : wallets[0] || null;

  const walletAddress = solanaWallet?.address || null;

  useEffect(() => {
    if (!ready) return;

    const storedSignature = sessionStorage.getItem(config.signatureKey);
    const storedAddress = sessionStorage.getItem(config.addressKey);

    if (storedSignature && storedAddress && walletAddress === storedAddress) {
      setState({
        signature: storedSignature,
        address: storedAddress,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState({
      signature: null,
      address: null,
      isLoading: false,
      error: null,
    });
  }, [ready, walletAddress, config.signatureKey, config.addressKey]);

  const requestSignature =
    useCallback(async (): Promise<SessionSignatureResult | null> => {
      const wallet = wallets.find((w) => w.address === walletAddress);
      if (!wallet) {
        setState((prev) => ({ ...prev, error: "No wallet connected" }));
        return null;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const messageBytes = new TextEncoder().encode(config.message);

        const { signature: signatureBytes } = await signMessage({
          message: messageBytes,
          wallet,
        });

        const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

        sessionStorage.setItem(config.signatureKey, signatureBase64);
        sessionStorage.setItem(config.addressKey, wallet.address);

        setState({
          signature: signatureBase64,
          address: wallet.address,
          isLoading: false,
          error: null,
        });

        return { signature: signatureBase64, address: wallet.address };
      } catch (error: any) {
        console.error("Failed to get signature:", error);
        setState({
          signature: null,
          address: null,
          isLoading: false,
          error: error.message || "Failed to sign message",
        });
        return null;
      }
    }, [
      walletAddress,
      wallets,
      signMessage,
      config.message,
      config.signatureKey,
      config.addressKey,
    ]);

  const getSignature =
    useCallback(async (): Promise<SessionSignatureResult | null> => {
      const stored = sessionStorage.getItem(config.signatureKey);
      const storedAddr = sessionStorage.getItem(config.addressKey);
      if (stored && storedAddr && walletAddress === storedAddr) {
        return { signature: stored, address: storedAddr };
      }
      return requestSignature();
    }, [
      walletAddress,
      requestSignature,
      config.signatureKey,
      config.addressKey,
    ]);

  useEffect(() => {
    if (ready && !authenticated) {
      for (const cfg of Object.values(SESSION_CONFIGS)) {
        sessionStorage.removeItem(cfg.signatureKey);
        sessionStorage.removeItem(cfg.addressKey);
      }
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("umbra_master_seed:")) toRemove.push(k);
      }
      for (const k of toRemove) sessionStorage.removeItem(k);
      setState({
        signature: null,
        address: null,
        isLoading: false,
        error: null,
      });
    }
  }, [ready, authenticated]);

  const clearSignature = useCallback(() => {
    sessionStorage.removeItem(config.signatureKey);
    sessionStorage.removeItem(config.addressKey);
    setState({
      signature: null,
      address: null,
      isLoading: false,
      error: null,
    });
  }, [config.signatureKey, config.addressKey]);

  const getAuthHeaders = useCallback(() => {
    if (!state.signature || !state.address) {
      return null;
    }
    return {
      "X-Session-Signature": state.signature,
      "X-Wallet-Address": state.address,
    };
  }, [state.signature, state.address]);

  return {
    ...state,
    requestSignature,
    getSignature,
    clearSignature,
    getAuthHeaders,
    isAuthenticated: authenticated,
    walletAddress: walletAddress || userWalletAddress || null,
  };
}

export { PC_SESSION_MESSAGE, MB_SESSION_MESSAGE, UMBRA_SESSION_MESSAGE };
export const SESSION_MESSAGE_TEXT = PC_SESSION_MESSAGE;
