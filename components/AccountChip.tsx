"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { useSessionSignature } from "@/hooks/useSessionSignature";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useSOLBalance } from "@/hooks/useSOLBalance";
import { formatNumber } from "@/utils";
import { AssetRow } from "./AssetRow";

/**
 * Account control shared by the home + the request/claim pages.
 * Collapsed: account total (USD). Expanded: per-asset rows + wallet info
 * (address/copy, X handle, logout). Not connected: a Connect Wallet trigger.
 *
 * `compact` shrinks the collapsed total for the transaction pages, where the
 * page's own big amount is the focus.
 */
export function AccountChip({ compact = false }: { compact?: boolean }) {
  const { login, authenticated, logout, user } = usePrivy();
  const { walletAddress } = useSessionSignature();
  const { balance } = useUSDCBalance(walletAddress);
  const { balance: solBalance, balanceUSD: solBalanceUSD } =
    useSOLBalance(walletAddress);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isXUser = !!user?.twitter;
  const twitterHandle = user?.twitter?.username;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const formatAddr = (a: string) =>
    a.length <= 10 ? a : `${a.slice(0, 4)}...${a.slice(-4)}`;

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-1.5 text-sm text-[#121212]/50 hover:text-[#121212]/70 underline underline-offset-4 decoration-dashed transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  const totalUSD = (balance ?? 0) + (solBalanceUSD ?? 0);
  const [whole, cents] = totalUSD.toFixed(2).split(".");

  const assets = [
    {
      symbol: "USDC",
      icon: "/assets/usdc-icon.svg",
      native: `${formatNumber(balance ?? 0)} USDC`,
      usd: balance ?? 0,
    },
    {
      symbol: "SOL",
      icon: "/assets/sol-icon.svg",
      native: `${(solBalance ?? 0).toFixed(4)} SOL`,
      usd: solBalanceUSD ?? 0,
    },
  ];

  return (
    <div className={compact ? "relative" : "relative w-full"} ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={
          compact
            ? "flex items-center gap-1.5 hover:opacity-70 transition-opacity"
            : "w-full flex items-center justify-center gap-2 py-2 rounded-2xl hover:bg-[#121212]/[0.03] transition-colors"
        }
      >
        <span
          className={
            compact
              ? "text-sm font-medium"
              : "text-3xl font-semibold whitespace-nowrap"
          }
        >
          <span className="text-[#121212]">${whole}</span>
          <span className="text-[#121212]/40">.{cents}</span>
        </span>
        <Image
          src="/assets/chevron-down-icon.svg"
          alt=""
          width={compact ? 10 : 14}
          height={compact ? 10 : 14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#fafafa] border border-[#121212]/10 rounded-2xl shadow-lg z-50 overflow-hidden"
          >
            {/* Assets */}
            {assets.map((asset) => (
              <AssetRow
                key={asset.symbol}
                className="px-4 py-3"
                icon={asset.icon}
                symbol={asset.symbol}
                native={asset.native}
                usd={`$${asset.usd.toFixed(2)}`}
              />
            ))}

            <div className="h-px bg-[#121212]/[0.08] mx-4" />

            {/* Wallet Address */}
            <button
              onClick={copied ? undefined : copyAddress}
              className={`w-full flex items-center gap-2.5 px-4 py-3 transition-colors ${copied ? "pointer-events-none" : "hover:bg-[#121212]/5"}`}
            >
              <Image src="/assets/sol-icon.svg" alt="" width={16} height={16} />
              <span className="text-[#121212] text-md flex-1 text-left">
                {walletAddress ? formatAddr(walletAddress) : ""}
              </span>
              <Image
                src={copied ? "/assets/success-alt.svg" : "/assets/copy-icon.svg"}
                alt=""
                width={copied ? 16 : 14}
                height={copied ? 8 : 14}
              />
            </button>

            {/* X Handle */}
            {isXUser && twitterHandle && (
              <a
                href={`https://x.com/${twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#121212]/5 transition-colors"
              >
                <Image src="/assets/x-icon.svg" alt="" width={16} height={16} />
                <span className="text-[#121212]/60 text-sm">@{twitterHandle}</span>
              </a>
            )}

            {/* Logout */}
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#121212]/5 transition-colors"
            >
              <Image src="/assets/logout-icon.svg" alt="" width={16} height={16} />
              <span className="text-[#121212] text-sm">Logout</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
