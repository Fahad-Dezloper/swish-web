"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { ProtocolBadge } from "./ProtocolBadge";
import { formatNumber } from "@/utils";
import { useFee } from "@/hooks/useFee";
import { estimateFee, type FlowKind } from "@/lib/fees";
import type { ProviderId } from "@/lib/providers/types";
import { isProviderDisabled } from "@/lib/providers/maintenance";

interface ProtocolMeta {
  signatures: string;
  time: string;
  anonymity: string;
  howItWorks: string;
}

const PROTOCOL_META: Record<ProviderId, ProtocolMeta> = {
  umbra: {
    signatures: "~3 prompts",
    time: "~10s",
    anonymity: "Shielded pool",
    howItWorks:
      "ZK shielded transfers via Arcium MPC. The recipient claims from a private pool with no on-chain link to the sender.",
  },
  "magicblock-per": {
    signatures: "~1 prompt",
    time: "~3s",
    anonymity: "TEE-encrypted",
    howItWorks:
      "Transfers run inside a Trusted Execution Environment (Intel TDX). Amounts and parties stay private.",
  },
  "privacy-cash": {
    signatures: "~1 prompt",
    time: "~5s",
    anonymity: "ZK UTXO pool",
    howItWorks:
      "Zero-knowledge UTXOs break the on-chain link between sender and receiver.",
  },
};

// Default routing preference (matches Auto router: Umbra > MB > PC for send).
// Sidebar surfaces available protocols in this order, with disabled ones
// pushed to the bottom.
const PROTOCOL_PREFERENCE: ProviderId[] = [
  "umbra",
  "magicblock-per",
  "privacy-cash",
];

interface ProtocolSidebarProps {
  effectiveProvider: ProviderId | "auto";
  onSelect: (p: ProviderId) => void;
  onClose: () => void;
  amount: number;
  flow: FlowKind;
  umbraStatus: "idle" | "checking" | "registered" | "unregistered" | "error";
  recipientUmbraStatus:
    | "idle"
    | "checking"
    | "registered"
    | "unregistered"
    | "error";
}

export function ProtocolSidebar({
  effectiveProvider,
  onSelect,
  onClose,
  amount,
  flow,
  umbraStatus,
  recipientUmbraStatus,
}: ProtocolSidebarProps) {
  const { baseFee } = useFee();

  const isProtocolDisabled = (p: ProviderId): boolean => {
    if (p === "umbra") {
      if (umbraStatus !== "registered") return true;
      if (recipientUmbraStatus === "unregistered") return true;
    }
    return isProviderDisabled(p);
  };

  // Sort: available protocols first (preserve preference order), disabled at bottom
  const orderedProtocols = [
    ...PROTOCOL_PREFERENCE.filter((p) => !isProtocolDisabled(p)),
    ...PROTOCOL_PREFERENCE.filter((p) => isProtocolDisabled(p)),
  ];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute inset-0 z-50 bg-[#fafafa] flex flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-2 pb-4 sticky top-0 bg-[#fafafa] z-10">
        <button
          onClick={onClose}
          aria-label="Back to send"
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-[#121212]/5 transition-colors"
        >
          <Image
            src="/assets/chevron-down-icon.svg"
            alt=""
            width={12}
            height={12}
            className="rotate-90"
          />
        </button>
        <h3 className="text-lg font-semibold text-[#121212]">
          Choose protocol
        </h3>
      </div>

      {/* Protocol cards */}
      <div className="px-6 pb-8 space-y-3">
        {orderedProtocols.map((p) => {
          const meta = PROTOCOL_META[p];
          const fee = estimateFee(p, amount, flow, baseFee);

          const senderUmbraDisabled =
            p === "umbra" && umbraStatus !== "registered";
          const recipientUmbraDisabled =
            p === "umbra" && recipientUmbraStatus === "unregistered";
          const maintenanceDisabled = isProviderDisabled(p);
          const isDisabled =
            senderUmbraDisabled ||
            recipientUmbraDisabled ||
            maintenanceDisabled;

          const disabledReason = maintenanceDisabled
            ? "Temporarily unavailable (maintenance)"
            : senderUmbraDisabled
              ? "Enable Umbra in your profile to use it."
              : recipientUmbraDisabled
                ? "Recipient is not registered on Umbra."
                : null;

          const isSelected = effectiveProvider === p;

          return (
            <button
              key={p}
              onClick={() => {
                if (isDisabled) return;
                onSelect(p);
              }}
              disabled={isDisabled}
              className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                isSelected
                  ? "border-[#121212]/30 bg-[#121212]/[0.03]"
                  : "border-[#121212]/10 hover:bg-[#121212]/[0.02]"
              } ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <ProtocolBadge providerId={p} iconSize={18} />
                {isSelected && (
                  <Image
                    src="/assets/success-alt.svg"
                    alt="Selected"
                    width={14}
                    height={7}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-3">
                <div className="text-[#121212]/50">Fee</div>
                <div className="text-[#121212] text-right">
                  {amount > 0
                    ? `~$${formatNumber(fee.feeUSDC)}`
                    : fee.breakdown}
                </div>
                <div className="text-[#121212]/50">Signatures</div>
                <div className="text-[#121212] text-right">
                  {meta.signatures}
                </div>
                <div className="text-[#121212]/50">Typical time</div>
                <div className="text-[#121212] text-right">{meta.time}</div>
                <div className="text-[#121212]/50">Anonymity</div>
                <div className="text-[#121212] text-right">
                  {meta.anonymity}
                </div>
              </div>

              <p className="text-xs text-[#121212]/60 leading-relaxed">
                {meta.howItWorks}
              </p>

              {disabledReason && (
                <p className="text-xs text-[#121212]/50 mt-3">
                  {disabledReason}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
