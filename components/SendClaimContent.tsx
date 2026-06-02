"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Spinner } from "./Spinner";
import { ProtocolBadge } from "./ProtocolBadge";
import { ProtocolSidebar } from "./ProtocolSidebar";
import { formatNumber } from "@/utils";
import { useSendClaimTransaction } from "@/hooks/useSendClaimTransaction";
import { useProtocolFee } from "@/hooks/useProtocolFee";
import { useAutoRoute } from "@/hooks/useAutoRoute";
import {
  useSessionSignature,
  type GetSessionSignature,
} from "@/hooks/useSessionSignature";
import type { ProviderId } from "@/lib/providers/types";
import { areAllProvidersDisabled } from "@/lib/providers/maintenance";

const SC_PROVIDER_POOL: ProviderId[] = ["magicblock-per", "privacy-cash"];

interface SendClaimContentProps {
  /** Amount entered on the shared keypad in SendModal. */
  amount: string;
  getSignature: GetSessionSignature;
  /** Return to the Send form (same modal). */
  onBack: () => void;
}

type ContentState = "input" | "loading" | "success" | "error";
// Umbra hidden from SC picker for the Frontier demo (Arcium MPC callbacks
// for `RegisterUserForAnonymousUsageV11` are unreliable, blocking the
// burner registration step). Backend code stays — re-enable by adding
// "umbra" back here + restoring the branches below.
type ProviderChoice = "auto" | "privacy-cash" | "magicblock-per";

/**
 * Claim-link creation, rendered INSIDE SendModal's Modal (no own Modal
 * shell) — the "Generate a claim link" button flips SendModal into this
 * mode, reusing the amount already on the keypad.
 */
export function SendClaimContent({
  amount,
  getSignature,
  onBack,
}: SendClaimContentProps) {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<ContentState>("input");
  const [claimLink, setClaimLink] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [provider, setProvider] = useState<ProviderChoice>("auto");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { sendClaim } = useSendClaimTransaction();
  // Each protocol's SC reclaim uses its own session message — the burner
  // privkey is encrypted with the sender's protocol-specific signature so
  // we must mint the right one when the user picks MB. PC's getSignature
  // is the parent prop fallback for "auto" and "privacy-cash".
  const { getSignature: getMbSessionSignature, walletAddress: senderAddress } =
    useSessionSignature("magicblock-per");

  const numAmount = parseFloat(amount) || 0;

  // Resolve Auto for SC. No receiver at sender time (recipient comes from
  // the claim link), so this only depends on MB /health. Umbra is never
  // an Auto target for SC — it stays picker-only (sender Umbra reg is
  // opt-in; Auto can't silently force it).
  const noAutoTarget = areAllProvidersDisabled(SC_PROVIDER_POOL);
  const { resolved: autoResolved, unavailable: autoUnavailable } = useAutoRoute({
    enabled: provider === "auto" && !!senderAddress,
    flow: "send_claim",
    senderAddress: senderAddress,
    receiverAddress: null,
  });

  // When picker = Auto, prefer the resolved provider for fee display +
  // session-sig minting; if not resolved yet, fall back to "auto"
  // (useProtocolFee treats this as PC worst-case).
  const effectiveProvider: ProviderChoice = (
    provider === "auto" ? (autoResolved ?? "auto") : provider
  ) as ProviderChoice;

  // Per-protocol fee. SC has different fee structure than direct send:
  //   PC: base + 0.35% (deducted from claim)
  //   MB: gas only
  //   Umbra: 0.7% on claim (protocol + relayer)
  const { feeUSDC: partnerFee, breakdown: feeBreakdown } = useProtocolFee(
    effectiveProvider,
    numAmount,
    "send_claim"
  );
  const total = numAmount - partnerFee;

  const handleProceed = async () => {
    // Resolve the dispatch provider. If the user picked Auto and
    // useAutoRoute hasn't returned yet (rare — auth + senderAddress
    // happen before the modal opens in practice), fall back to PC so
    // the user can proceed.
    const dispatchProvider: ProviderId =
      provider === "auto"
        ? (autoResolved ?? "privacy-cash")
        : (provider as ProviderId);

    // Pick the session-sig hook matching the dispatch provider. The
    // server validates the sig against `getSessionMessageForProvider`,
    // so picking the wrong hook here = 401.
    const sessionForProvider = (id: ProviderId) =>
      id === "magicblock-per" ? getMbSessionSignature() : getSignature();

    const session = await sessionForProvider(dispatchProvider);
    if (!session) {
      setErrorMessage("Signature required to continue");
      setState("error");
      return;
    }

    setState("loading");
    setErrorMessage(null);

    try {
      // No silent fallback: if the resolved provider fails, surface the
      // error and let the user retry. Auto-switching protocols changes the
      // fee the user agreed to without consent.
      const result = await sendClaim({
        amount: numAmount,
        token: "USDC",
        message: message.trim() || undefined,
        signature: session.signature,
        senderPublicKey: session.address,
        providerId: dispatchProvider,
      });

      setClaimLink(result.claimLink);
      setPassphrase(result.passphrase);
      setState("success");
    } catch (error: any) {
      console.error("Send claim failed:", error);
      setErrorMessage(error.message || "Something went wrong");
      setState("error");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${claimLink}\n\nPassphrase: ${passphrase}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleRetry = () => {
    setState("input");
    setErrorMessage(null);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Image
          src="/assets/send.svg"
          alt="Send"
          width={24}
          height={24}
          className="invert"
        />
        <h2 className="text-2xl font-semibold text-[#121212]">Send via Claim</h2>
      </div>

      <AnimatePresence mode="wait">
        {state === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Back to the send form (claim link is a branch off it) */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 mb-4 text-sm text-[#121212]/50 hover:text-[#121212] transition-colors"
            >
              <Image
                src="/assets/chevron-down-icon.svg"
                alt=""
                width={10}
                height={10}
                className="rotate-90"
              />
              Back to send
            </button>

            {/* Message Input */}
            <div className="mb-6">
              <label className="text-sm text-[#121212]/50 mb-2 block">
                Add message (optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => {
                    if (e.target.value.length <= 50) setMessage(e.target.value);
                  }}
                  maxLength={50}
                  placeholder=""
                  className="w-full h-12 px-4 pr-16 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors"
                />
                <span
                  className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs ${message.length >= 50 ? "text-red-500" : "text-[#121212]/30"}`}
                >
                  {message.length}/50
                </span>
              </div>
            </div>

            {/* Amount Details */}
            <div className="space-y-3 mb-8">
              <div className="flex justify-between">
                <span className="text-[#121212]">Amount</span>
                <span className="text-[#121212]">
                  {formatNumber(numAmount)} USDC
                </span>
              </div>
              {(provider !== "auto" || autoResolved) && (
                <div className="flex justify-between items-center">
                  <span className="text-[#121212]">Routed via</span>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex items-center gap-1.5 text-[#121212] cursor-pointer hover:opacity-70 transition-opacity"
                  >
                    {provider === "auto" && autoResolved ? (
                      <>
                        <span className="text-[10px] font-medium text-[#121212]/60 uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-[#121212]/15">
                          Auto
                        </span>
                        <ProtocolBadge providerId={autoResolved} />
                      </>
                    ) : (
                      <ProtocolBadge providerId={provider as ProviderId} />
                    )}
                    <Image
                      src="/assets/chevron-down-icon.svg"
                      alt=""
                      width={10}
                      height={10}
                      className="-rotate-90"
                    />
                  </button>
                </div>
              )}
              <div className="flex justify-between">
                <div>
                  <span className="text-[#121212]">Partner Fees</span>
                  <span className="text-[#121212]/40 text-xs ml-1">
                    ({feeBreakdown})
                  </span>
                </div>
                <span className="text-[#121212]">
                  ~{formatNumber(partnerFee)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212] font-semibold">
                  They Receive
                </span>
                <span className="text-[#121212] font-semibold">
                  ~{formatNumber(total)} USDC
                </span>
              </div>
            </div>

            {/* Proceed Button */}
            <motion.button
              onClick={handleProceed}
              disabled={provider === "auto" && (noAutoTarget || autoUnavailable)}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Create claim link
            </motion.button>
          </motion.div>
        )}

        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Spinner size={48} color="#121212" />
            <p className="mt-4 text-[#121212]/70">Generating claim link...</p>
          </motion.div>
        )}

        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Success Details */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-[#121212]">Amount</span>
                <span className="text-[#121212]">
                  {formatNumber(numAmount)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212]">Partner Fees</span>
                <span className="text-[#121212]">
                  ~{formatNumber(partnerFee)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212] font-semibold">
                  They Receive
                </span>
                <span className="text-[#121212] font-semibold">
                  ~{formatNumber(total)} USDC
                </span>
              </div>
            </div>

            {/* Copy Link Button */}
            <motion.button
              onClick={copied ? undefined : handleCopyLink}
              whileTap={copied ? {} : { scale: 0.98 }}
              className={`w-full h-10 bg-[#121212] rounded-full flex items-center justify-center gap-2 text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)] ${copied ? "pointer-events-none" : ""}`}
            >
              <Image
                src={copied ? "/assets/success.svg" : "/assets/copy-icon.svg"}
                alt=""
                width={copied ? 16 : 16}
                height={copied ? 8 : 16}
                className={copied ? "" : "invert"}
              />
              {copied ? "Copied!" : "Copy Claim Link"}
            </motion.button>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <p className="text-[#121212] font-medium mb-2">
              Failed to Generate Link
            </p>
            <p className="text-[#121212]/60 text-sm text-center mb-6">
              {errorMessage || "Something went wrong"}
            </p>
            <motion.button
              onClick={handleRetry}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Try Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pickerOpen && (
          <ProtocolSidebar
            effectiveProvider={effectiveProvider}
            onSelect={(p) => {
              setProvider(p as ProviderChoice);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
            amount={numAmount}
            flow="send_claim"
            umbraStatus="idle"
            recipientUmbraStatus="idle"
          />
        )}
      </AnimatePresence>
    </>
  );
}
