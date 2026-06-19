"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { QRScanner } from "./QRScanner";
import { NumberPad } from "./NumberPad";
import { AmountField } from "./AmountField";
import { SendClaimContent } from "./SendClaimContent";
import { ProtocolBadge } from "./ProtocolBadge";
import { ProtocolSidebar } from "./ProtocolSidebar";
import { formatNumber, appendAmountKey, decimalsForAsset } from "@/utils";
import { useSendTransaction } from "@/hooks/useSendTransaction";
import { useUmbraSend } from "@/hooks/useUmbraSend";
import { useUmbraStatus } from "@/hooks/useUmbraStatus";
import { useProtocolFee } from "@/hooks/useProtocolFee";
import { useAutoRoute } from "@/hooks/useAutoRoute";
import { useSOLBalance } from "@/hooks/useSOLBalance";
import {
  useSessionSignature,
  type GetSessionSignature,
} from "@/hooks/useSessionSignature";
import type { ProviderId } from "@/lib/providers/types";
import {
  areAllProvidersDisabled,
  isProviderDisabled,
} from "@/lib/providers/maintenance";

const SOL_DUST_THRESHOLD = 5_000;

const SEND_PROVIDER_POOL: ProviderId[] = [
  "umbra",
  "magicblock-per",
  "privacy-cash",
];

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number | null;
  getSignature: GetSessionSignature;
}

type ModalState = "input" | "loading" | "success" | "error";
type EntryStep = "amount" | "form";
type SendMode = "send" | "claim";
type RecipientType = "wallet" | "x";
type ProviderChoice = "auto" | "privacy-cash" | "magicblock-per" | "umbra";

export function SendModal({
  isOpen,
  onClose,
  balance,
  getSignature,
}: SendModalProps) {
  const [amount, setAmount] = useState("0");
  const [entryStep, setEntryStep] = useState<EntryStep>("amount");
  const [mode, setMode] = useState<SendMode>("send");
  const [walletAddress, setWalletAddress] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("wallet");
  const [provider, setProvider] = useState<ProviderChoice>("auto");
  const [recipientUmbraStatus, setRecipientUmbraStatus] = useState<
    "idle" | "checking" | "registered" | "unregistered" | "error"
  >("idle");
  const [resolvedXAddress, setResolvedXAddress] = useState<string | null>(null);
  const [state, setState] = useState<ModalState>("input");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isResolvingX, setIsResolvingX] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { send } = useSendTransaction();
  const { send: umbraSend, state: umbraSendState } = useUmbraSend();
  const { status: umbraStatus } = useUmbraStatus();
  const {
    getSignature: getMbSessionSignature,
    walletAddress: senderAddress,
  } = useSessionSignature("magicblock-per");

  const { balance: solBalance } = useSOLBalance(senderAddress);
  const insufficientSol =
    solBalance !== null && solBalance * 1e9 < SOL_DUST_THRESHOLD;

  const numAmount = parseFloat(amount) || 0;
  const hasValidAmount = numAmount > 0;
  const exceedsBalance = balance !== null && numAmount > balance;

  const handleNumberPress = (num: string) => {
    setAmount((prev) => appendAmountKey(prev, num, decimalsForAsset("USDC")));
  };

  const handleBackspace = () => {
    if (amount.length === 1) {
      setAmount("0");
    } else {
      setAmount(amount.slice(0, -1));
    }
  };

  const isValidAddress = useMemo(() => {
    if (!walletAddress) return false;
    try {
      new PublicKey(walletAddress);
      return true;
    } catch {
      return false;
    }
  }, [walletAddress]);

  const isValidXHandle = useMemo(() => {
    if (!xHandle) return false;
    return /^[a-zA-Z0-9_]{1,15}$/.test(xHandle);
  }, [xHandle]);

  const xResolveSettled =
    recipientUmbraStatus !== "idle" && recipientUmbraStatus !== "checking";
  const noAutoTarget = areAllProvidersDisabled(SEND_PROVIDER_POOL);
  const { resolved: autoResolved, unavailable: autoUnavailable } = useAutoRoute({
    enabled:
      provider === "auto" &&
      ((recipientType === "wallet" && isValidAddress) ||
        (recipientType === "x" && isValidXHandle && xResolveSettled)),
    flow: "send",
    senderAddress: senderAddress,
    receiverAddress:
      recipientType === "wallet" && isValidAddress
        ? walletAddress
        : recipientType === "x"
          ? resolvedXAddress
          : null,
  });

  const effectiveProvider: ProviderId | "auto" =
    provider === "auto" ? (autoResolved ?? "auto") : provider;

  const { feeUSDC: partnerFee, breakdown: feeBreakdown } = useProtocolFee(
    effectiveProvider,
    numAmount,
    "send"
  );
  const total = numAmount - partnerFee;

  const canProceed =
    recipientType === "wallet" ? isValidAddress : isValidXHandle;

  useEffect(() => {
    const validWallet = recipientType === "wallet" && isValidAddress;
    const validX = recipientType === "x" && isValidXHandle;
    if (!validWallet && !validX) {
      setRecipientUmbraStatus("idle");
      setResolvedXAddress(null);
      return;
    }
    let cancelled = false;
    setRecipientUmbraStatus("checking");
    const t = setTimeout(async () => {
      try {
        if (validWallet) {
          const res = await fetch(
            `/api/umbra/status?address=${encodeURIComponent(walletAddress)}`
          );
          if (cancelled) return;
          if (!res.ok) {
            setRecipientUmbraStatus("error");
            return;
          }
          const json = (await res.json()) as { registered: boolean };
          setRecipientUmbraStatus(
            json.registered ? "registered" : "unregistered"
          );
        } else {
          const res = await fetch(
            `/api/user/check-x?handle=${encodeURIComponent(xHandle)}`
          );
          if (cancelled) return;
          if (!res.ok) {
            setRecipientUmbraStatus("error");
            return;
          }
          const json = (await res.json()) as {
            exists: boolean;
            walletAddress: string | null;
            umbraRegistered: boolean;
          };
          setResolvedXAddress(json.walletAddress);
          setRecipientUmbraStatus(
            json.umbraRegistered ? "registered" : "unregistered"
          );
        }
      } catch {
        if (!cancelled) setRecipientUmbraStatus("error");
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [walletAddress, xHandle, recipientType, isValidAddress, isValidXHandle]);

  const umbraBlockedByRecipient =
    provider === "umbra" && recipientUmbraStatus === "unregistered";

  const resolveXHandle = async (): Promise<string | null> => {
    setIsResolvingX(true);
    try {
      const res = await fetch("/api/user/resolve-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitterHandle: xHandle }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resolve X handle");
      }

      const { walletAddress: resolved } = await res.json();
      return resolved;
    } catch (err: any) {
      throw err;
    } finally {
      setIsResolvingX(false);
    }
  };

  const handleProceed = async () => {
    if (!canProceed) return;

    setState("loading");
    setErrorMessage(null);

    try {
      let receiverAddress = walletAddress;

      if (recipientType === "x") {
        const resolved = await resolveXHandle();
        if (!resolved) {
          throw new Error("Could not resolve X handle to wallet address");
        }
        receiverAddress = resolved;
        setWalletAddress(resolved);
      }

      let dispatchProvider: ProviderId | "auto" = effectiveProvider;
      if (provider === "auto" && dispatchProvider === "auto") {
        const previewRes = await fetch(
          `/api/router/preview?flow=send&sender=${encodeURIComponent(
            senderAddress || ""
          )}&receiver=${encodeURIComponent(receiverAddress)}`
        );
        const previewJson = (await previewRes.json()) as {
          providerId: ProviderId;
        };
        dispatchProvider = previewJson.providerId;
      }

      if (dispatchProvider === "umbra") {
        const baseUnits = BigInt(Math.floor(numAmount * 1_000_000));
        await umbraSend({
          receiverAddress,
          amountBaseUnits: baseUnits,
        });
      } else {
        const session =
          dispatchProvider === "magicblock-per"
            ? await getMbSessionSignature()
            : await getSignature();
        if (!session) {
          throw new Error("Signature required to continue");
        }
        await send({
          receiverAddress,
          amount: numAmount,
          token: "USDC",
          signature: session.signature,
          senderPublicKey: session.address,
          providerId: dispatchProvider,
        });
      }
      setState("success");
    } catch (error: any) {
      console.error("Send failed:", error);
      setErrorMessage(error.message || "Transaction failed");
      setState("error");
    }
  };

  const handleClose = () => {
    setState("input");
    setAmount("0");
    setEntryStep("amount");
    setMode("send");
    setWalletAddress("");
    setXHandle("");
    setRecipientType("wallet");
    setProvider("auto");
    setErrorMessage(null);
    setIsResolvingX(false);
    setRecipientUmbraStatus("idle");
    onClose();
  };

  const handleRetry = () => {
    setState("input");
    setErrorMessage(null);
  };

  const handleQRScan = (address: string) => {
    setWalletAddress(address);
    setShowQRScanner(false);
  };

  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const displayRecipient =
    recipientType === "x" && xHandle ? `@${xHandle}` : formatAddress(walletAddress);

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose}>
        {mode === "claim" ? (
          <SendClaimContent
            amount={amount}
            getSignature={getSignature}
            onBack={() => setMode("send")}
          />
        ) : (
        <>
        <div className="flex items-center gap-2 mb-6">
          <Image
            src="/assets/send.svg"
            alt="Send"
            width={24}
            height={24}
            className="invert"
          />
          <h2 className="text-2xl font-semibold text-[#121212]">Send</h2>
        </div>

        <AnimatePresence mode="wait">
          {state === "input" && entryStep === "amount" && (
            <motion.div
              key="amount"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-3">
                <AmountField
                  amount={amount}
                  assetSymbol="USDC"
                  onMax={
                    balance !== null && balance > 0
                      ? () => setAmount(String(balance))
                      : undefined
                  }
                />
              </div>
              <p className="text-sm text-center mb-6 h-5">
                {exceedsBalance ? (
                  <span className="text-[#CB0000]">Exceeds your balance</span>
                ) : balance !== null ? (
                  <span className="text-[#121212]/50">
                    {formatNumber(balance)} USDC available
                  </span>
                ) : (
                  " "
                )}
              </p>

              <div className="mb-6 w-full flex justify-center">
                <NumberPad
                  onNumberPress={handleNumberPress}
                  onBackspace={handleBackspace}
                />
              </div>

              <motion.button
                onClick={() => setEntryStep("form")}
                disabled={!hasValidAmount || exceedsBalance}
                whileTap={{ scale: 0.98 }}
                className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
              >
                Continue
              </motion.button>
            </motion.div>
          )}

          {state === "input" && entryStep === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                onClick={() => setEntryStep("amount")}
                className="flex items-center gap-1.5 mb-4 text-sm text-[#121212]/50 hover:text-[#121212] transition-colors"
              >
                <Image
                  src="/assets/chevron-down-icon.svg"
                  alt=""
                  width={10}
                  height={10}
                  className="rotate-90"
                />
                Edit amount
              </button>

              <div className="flex mb-4 bg-[#121212]/5 rounded-full p-1">
                <button
                  onClick={() => setRecipientType("wallet")}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-full text-sm font-medium transition-all ${
                    recipientType === "wallet"
                      ? "bg-[#121212] text-[#fafafa]"
                      : "text-[#121212]/50"
                  }`}
                >
                  <Image
                    src="/assets/sol-icon.svg"
                    alt=""
                    width={14}
                    height={14}

                  />
                  Wallet
                </button>
                <button
                  onClick={() => setRecipientType("x")}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-full text-sm font-medium transition-all ${
                    recipientType === "x"
                      ? "bg-[#121212] text-[#fafafa]"
                      : "text-[#121212]/50"
                  }`}
                >
                  <Image
                    src="/assets/x-icon.svg"
                    alt=""
                    width={14}
                    height={14}
                    className={recipientType === "x" ? "invert" : ""}
                  />
                  X Profile
                </button>
              </div>

              <div className="mb-6">
                {recipientType === "wallet" ? (
                  <>
                    <label className="text-sm text-[#121212]/50 mb-1 block">
                      Enter wallet address
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder=""
                        className="flex-1 h-12 px-4 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors"
                      />
                      <button
                        onClick={() => setShowQRScanner(true)}
                        className="w-12 h-12 rounded-full border border-[#121212]/10 flex items-center justify-center hover:bg-[#121212]/5 transition-colors shrink-0"
                      >
                        <Image
                          src="/assets/scan-icon.svg"
                          alt="Scan QR"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-sm text-[#121212]/50 mb-1 block">
                      Enter X profile (without @)
                    </label>
                    <input
                      type="text"
                      value={xHandle}
                      onChange={(e) =>
                        setXHandle(e.target.value.replace(/^@/, ""))
                      }
                      placeholder=""
                      className="w-full h-12 px-4 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors"
                    />
                  </>
                )}
              </div>

              <div className="space-y-2 mb-8">
                <div className="flex justify-between">
                  <span className="text-[#121212]">Amount</span>
                  <span className="text-[#121212]">
                    {formatNumber(numAmount)} USDC
                  </span>
                </div>
                {((recipientType === "wallet" && isValidAddress) ||
                  (recipientType === "x" && isValidXHandle)) &&
                  (provider !== "auto" || autoResolved) && (
                  <>
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
                    {provider === "umbra" && umbraStatus === "unregistered" && (
                      <p className="text-xs text-[#121212]/50">
                        Enable Umbra in your{" "}
                        <a
                          href="/p"
                          className="underline underline-offset-2 decoration-dashed hover:text-[#121212]"
                        >
                          profile
                        </a>{" "}
                        to send via Umbra.
                      </p>
                    )}
                    {provider === "umbra" &&
                      umbraStatus === "registered" &&
                      recipientUmbraStatus === "unregistered" && (
                        <p className="text-xs text-[#121212]/50">
                          Recipient is not registered on Umbra
                        </p>
                      )}
                  </>
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

              {insufficientSol && (
                <p className="text-[#CB0000] text-sm mb-3">
                  Not enough SOL for gas fees. Add SOL to your wallet to
                  proceed.
                </p>
              )}

              <motion.button
                onClick={handleProceed}
                disabled={
                  !canProceed ||
                  isResolvingX ||
                  umbraBlockedByRecipient ||
                  insufficientSol ||
                  (provider === "auto" &&
                    (noAutoTarget || autoUnavailable || !autoResolved))
                }
                whileTap={{ scale: 0.98 }}
                className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
              >
                {isResolvingX ? "Resolving..." : "Proceed"}
              </motion.button>

              <button
                onClick={() => setMode("claim")}
                disabled={recipientType === "x"}
                className={`w-full mt-4 text-[#121212]/70 text-sm underline underline-offset-4 decoration-dashed hover:text-[#121212] transition-colors ${recipientType === "x" ? "invisible pointer-events-none" : ""}`}
              >
                Generate a claim link
              </button>
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
              <p className="mt-4 text-[#121212]/70">
                {provider === "umbra"
                  ? umbraSendState.stage === "checking-recipient"
                    ? "Checking recipient on Umbra..."
                    : umbraSendState.stage === "depositing"
                      ? "Sign each prompt to send privately"
                      : umbraSendState.stage === "recording"
                        ? "Finalizing..."
                        : "Preparing private send..."
                  : "Processing transaction..."}
              </p>
              {provider === "umbra" && umbraSendState.stage === "depositing" && (
                <p className="mt-1 text-[#121212]/50 text-xs">
                  ~3 wallet prompts total
                </p>
              )}
            </motion.div>
          )}

          {state === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="space-y-2 mb-8">
                <div className="flex justify-between">
                  <span className="text-[#121212]">Sent To</span>
                  <span className="text-[#121212]">{displayRecipient}</span>
                </div>
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

              <motion.button
                onClick={handleClose}
                whileTap={{ scale: 0.98 }}
                className="w-full h-10 bg-[#fafafa] border border-[#121212]/70 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
              >
                <Image
                  src="/assets/success-alt.svg"
                  alt="Success"
                  width={24}
                  height={24}
                />
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
                Transaction Failed
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
                setProvider(p);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
              amount={numAmount}
              flow="send"
              umbraStatus={umbraStatus}
              recipientUmbraStatus={recipientUmbraStatus}
            />
          )}
        </AnimatePresence>
        </>
        )}
      </Modal>

      {showQRScanner && (
        <QRScanner
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
        />
      )}
    </>
  );
}
