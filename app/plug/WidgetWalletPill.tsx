"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useSOLBalance } from "@/hooks/useSOLBalance";
import { formatNumber } from "@/utils";
import { AssetRow } from "@/components";

/**
 * The connected-wallet pill for the Plug widget. Visually a copy of the app's
 * AccountChip (same chip + AssetRow dropdown + palette), but wired to the
 * PAYER'S external wallet instead of a logged-in Swish account:
 *   - balances read from the passed `address` (not the logged-in Swish wallet)
 *   - `Disconnect` instead of `Logout`, no X-handle row
 *
 * The dropdown overlays the form below it (absolute, centered on the pill);
 * since the pill sits at the top of the card with the form beneath, the
 * overlay stays within the iframe bounds and isn't clipped.
 *
 * Deliberately a separate file: the live AccountChip stays untouched.
 */
export function WidgetWalletPill({
  address,
  onDisconnect,
  disabled = false,
}: {
  address: string;
  onDisconnect: () => void;
  disabled?: boolean;
}) {
  const { balance } = useUSDCBalance(address);
  const { balance: solBalance, balanceUSD: solBalanceUSD } =
    useSOLBalance(address);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const formatAddr = (a: string) =>
    a.length <= 10 ? a : `${a.slice(0, 4)}...${a.slice(-4)}`;

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
    <div className="relative" ref={ref}>
      {/* Collapsed pill: green dot + balance total + chevron */}
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        className="flex items-center gap-1.5 hover:opacity-70 disabled:opacity-40 transition-opacity"
        title="Connected wallet"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#008834]" />
        <span className="text-lg font-medium">
          <span className="text-[#121212]">${whole}</span>
          <span className="text-[#121212]/40">.{cents}</span>
        </span>
        <Image
          src="/assets/chevron-down-icon.svg"
          alt=""
          width={13}
          height={13}
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

            {/* Wallet address (copy) */}
            <button
              onClick={copied ? undefined : copyAddress}
              className={`w-full flex items-center gap-2.5 px-4 py-3 transition-colors ${
                copied ? "pointer-events-none" : "hover:bg-[#121212]/5"
              }`}
            >
              <Image src="/assets/sol-icon.svg" alt="" width={16} height={16} />
              <span className="text-[#121212] text-md flex-1 text-left">
                {formatAddr(address)}
              </span>
              <Image
                src={copied ? "/assets/success-alt.svg" : "/assets/copy-icon.svg"}
                alt=""
                width={copied ? 16 : 14}
                height={copied ? 8 : 14}
              />
            </button>

            {/* Disconnect (external wallet — not a Swish logout) */}
            <button
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#121212]/5 transition-colors"
            >
              <Image src="/assets/logout-icon.svg" alt="" width={16} height={16} />
              <span className="text-[#121212] text-sm">Disconnect</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
