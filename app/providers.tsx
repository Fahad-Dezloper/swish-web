"use client";

import { useEffect, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

const solanaConnectors =
  typeof window !== "undefined"
    ? toSolanaWalletConnectors({ shouldAutoConnect: true })
    : undefined;

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!privyAppId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID not set");
    return null;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          accentColor: "#000000",
          theme: "#FFFFFF",
          showWalletLoginFirst: false,
          logo: "/assets/logo.svg",
          walletChainType: "solana-only",
          walletList: [
            "detected_solana_wallets",
            "phantom",
            "solflare",
            "backpack",
          ],
        },
        loginMethods: ["wallet", "twitter"],
        fundingMethodConfig: {
          moonpay: {
            useSandbox: true,
          },
        },
        embeddedWallets: {
          showWalletUIs: true,
          ethereum: {
            createOnLogin: "off",
          },
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        solana: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rpcs: {
            "solana:mainnet": {
              rpc: createSolanaRpc(process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com"),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                (process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com")
                  .replace("https://", "wss://")
              ),
            },
          } as any,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
