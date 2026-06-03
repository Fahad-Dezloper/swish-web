"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet } from "@privy-io/react-auth/solana";
import { formatNumber } from "@/utils";
import {
  Spinner,
  AddFundsModal,
  WithdrawModal,
  UnlockModal,
  ActivityItem,
  AssetRow,
} from "@/components";
import { useSessionSignature } from "@/hooks/useSessionSignature";
import { useUserActivity } from "@/hooks/useUserActivity";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useSOLBalance } from "@/hooks/useSOLBalance";
import { useUmbraStatus } from "@/hooks/useUmbraStatus";
import { useUmbraRegister } from "@/hooks/useUmbraRegister";
import { useUmbraBalance } from "@/hooks/useUmbraBalance";

type TabType = "wallet" | "activity";

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const { login, logout, authenticated, user } = usePrivy();
  const { exportWallet } = useExportWallet();
  const { walletAddress, getSignature } = useSessionSignature();
  const {
    balance: usdcBalance,
    isLoading: usdcLoading,
    refetch: refetchUSDCBalance,
  } = useUSDCBalance(walletAddress);
  const {
    balance: solBalance,
    balanceUSD: solBalanceUSD,
    isLoading: solLoading,
    refetch: refetchSOLBalance,
  } = useSOLBalance(walletAddress);

  const refreshBalances = () => {
    refetchUSDCBalance();
    refetchSOLBalance();
  };

  const { status: umbraStatus, refetch: refetchUmbraStatus } = useUmbraStatus();
  const { register: registerUmbra, state: umbraRegisterState } = useUmbraRegister();
  const isUmbraRegistered = umbraStatus === "registered";
  const {
    totalUSDC: umbraBalanceUSDC,
    totalBaseUnits: umbraBalanceBaseUnits,
    hasPending: umbraHasPending,
    status: umbraBalanceStatus,
    error: umbraBalanceError,
    refetch: refetchUmbraBalance,
  } = useUmbraBalance(isUmbraRegistered);
  const [showUnlock, setShowUnlock] = useState(false);

  const {
    activities: allActivities,
    stats,
    isLoading,
  } = useUserActivity(walletAddress);
  const [activeTab, setActiveTab] = useState<TabType>(
    searchParams.get("tab") === "activity" ? "activity" : "wallet"
  );

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/p?tab=${tab}`);
  };

  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [copied, setCopied] = useState(false);

  const isXUser = !!user?.twitter;
  const twitterHandle = user?.twitter?.username;

  const formatAddr = (addr: string) => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRegisterUmbra = async () => {
    try {
      await registerUmbra();
    } catch {
      // hook surfaces error in state
    } finally {
      refetchUmbraStatus();
    }
  };

  const isRegisteringUmbra =
    umbraRegisterState.stage === "checking" ||
    umbraRegisterState.stage === "registering";

  const handleOpenUnlock = () => {
    if (!umbraBalanceBaseUnits || umbraBalanceBaseUnits === BigInt(0)) return;
    setShowUnlock(true);
  };

  if (!authenticated) {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <motion.button
          onClick={login}
          whileTap={{ scale: 0.98 }}
          className="px-8 h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold cursor-pointer shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
        >
          Connect Wallet
        </motion.button>
      </main>
    );
  }

  if (isLoading && allActivities.length === 0 && !stats) {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <Spinner size={48} color="#121212" />
        <p className="mt-4 text-[#121212]/70">Loading profile...</p>
      </main>
    );
  }

  const totalUSD =
    (usdcBalance || 0) +
    (solBalanceUSD || 0) +
    (umbraBalanceStatus === "ready" ? umbraBalanceUSDC || 0 : 0);
  const [totalWhole, totalCents] = totalUSD.toFixed(2).split(".");

  return (
    <>
      <main className="flex flex-col items-center gap-6 p-4 w-full h-[stretch]">
        {/* Header: Address + X handle */}
        <div className="w-full max-w-[320px]">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[#121212] font-medium text-lg">
              {walletAddress ? formatAddr(walletAddress) : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copied ? undefined : handleCopyAddress}
                className={`p-1 rounded-full transition-colors ${
                  copied
                    ? "pointer-events-none cursor-default"
                    : "hover:bg-[#121212]/5 cursor-pointer"
                }`}
              >
                <Image
                  src={copied ? "/assets/success-alt.svg" : "/assets/copy-icon.svg"}
                  alt=""
                  width={16}
                  height={copied ? 8 : 16}
                />
              </button>
              <button
                onClick={logout}
                className="p-1 hover:bg-[#121212]/5 rounded-full transition-colors cursor-pointer"
              >
                <Image
                  src="/assets/logout-icon.svg"
                  alt="Logout"
                  width={16}
                  height={16}
                />
              </button>
            </div>
          </div>
          {isXUser && twitterHandle && (
            <div className="flex items-center gap-1.5 mt-1">
              <Image src="/assets/x-icon.svg" alt="X" width={14} height={14} />
              <a
                className="text-[#121212]/60 text-sm decoration-dashed underline underline-offset-4"
                href={`https://x.com/${twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{twitterHandle}
              </a>
            </div>
          )}
        </div>

        {/* Tab Toggle */}
        <div className="w-full max-w-[320px] flex bg-[#121212]/5 rounded-full p-1">
          <button
            onClick={() => selectTab("wallet")}
            className={`flex-1 h-8 rounded-full text-sm font-medium transition-all cursor-pointer ${
              activeTab === "wallet"
                ? "bg-[#121212] text-[#fafafa]"
                : "text-[#121212]/50"
            }`}
          >
            Wallet
          </button>
          <button
            onClick={() => selectTab("activity")}
            className={`flex-1 h-8 rounded-full text-sm font-medium transition-all cursor-pointer ${
              activeTab === "activity"
                ? "bg-[#121212] text-[#fafafa]"
                : "text-[#121212]/50"
            }`}
          >
            Activity
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "wallet" && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 w-full max-w-[320px]"
            >
              {/* Total Balance */}
              <div className="text-center">
                <p className="text-[#121212]/50 text-sm mb-1">Total Balance</p>
                <p className="text-4xl font-semibold">
                  {usdcLoading || solLoading ? (
                    <span className="text-[#121212]">...</span>
                  ) : (
                    <>
                      <span className="text-[#121212]">${totalWhole}</span>
                      <span className="text-[#121212]/40">.{totalCents}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Token Rows */}
              <div className="space-y-3">
                <AssetRow
                  icon="/assets/usdc-icon.svg"
                  symbol="USDC"
                  native={usdcLoading ? "..." : `${formatNumber(usdcBalance || 0)} USDC`}
                  usd={usdcLoading ? "..." : `$${(usdcBalance || 0).toFixed(2)}`}
                />
                <AssetRow
                  icon="/assets/sol-icon.svg"
                  symbol="SOL"
                  native={solLoading ? "..." : `${(solBalance || 0).toFixed(4)} SOL`}
                  usd={solLoading ? "..." : `$${(solBalanceUSD || 0).toFixed(2)}`}
                />
              </div>

              {/* Umbra section */}
              <div className="border-t border-[#121212]/10 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[#121212] text-sm font-medium">
                      <Image
                        src="/assets/Umbra-Logo-1.png"
                        alt=""
                        width={16}
                        height={16}
                      />
                      <span>Umbra</span>
                    </div>
                    {!isUmbraRegistered && (
                      <p className="text-[#121212]/50 text-xs mt-0.5">
                        Enable to receive private USDC via Umbra
                      </p>
                    )}
                  </div>
                  {isUmbraRegistered ? (
                    <span className="text-xs font-medium text-[#008834] px-2.5 py-1 rounded-full bg-[#008834]/10 whitespace-nowrap">
                      Enabled
                    </span>
                  ) : (
                    <motion.button
                      onClick={handleRegisterUmbra}
                      disabled={
                        isRegisteringUmbra ||
                        umbraStatus === "loading" ||
                        umbraStatus === "no-wallet"
                      }
                      whileTap={{ scale: 0.98 }}
                      className="text-xs font-semibold px-3 h-7 rounded-full bg-[#121212] text-[#fafafa] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isRegisteringUmbra ? "Working…" : "Enable"}
                    </motion.button>
                  )}
                </div>
                {!isUmbraRegistered && !isRegisteringUmbra && (
                  <p className="text-[#121212]/40 text-[11px] mt-2">
                    One-time setup; you&apos;ll sign ~4–5 wallet prompts. Most of the SOL staged is auto-refunded; net cost ~$0.60.
                  </p>
                )}
                {umbraRegisterState.error && (
                  <p className="text-[#CB0000] text-xs mt-2 break-words">
                    {umbraRegisterState.error.split("\n")[0]}
                  </p>
                )}

                {/* Shielded balance + Reveal/Unlock (registered only) */}
                {isUmbraRegistered && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#121212]/50 text-xs">Shielded balance</p>
                        <div className="text-[#121212] text-sm font-medium h-5 flex items-center">
                          {umbraBalanceStatus === "needs-reveal" ? (
                            "Hidden"
                          ) : umbraBalanceStatus === "loading" ? (
                            <Spinner size={14} color="#121212" />
                          ) : umbraBalanceStatus === "error" ? (
                            "—"
                          ) : (
                            `${formatNumber(umbraBalanceUSDC || 0)} USDC`
                          )}
                        </div>
                      </div>
                      {umbraBalanceStatus === "needs-reveal" ||
                      umbraBalanceStatus === "loading" ? (
                        <motion.button
                          onClick={async () => {
                            await refetchUmbraBalance();
                            refetchUSDCBalance();
                          }}
                          disabled={umbraBalanceStatus === "loading"}
                          whileTap={{ scale: 0.98 }}
                          className="text-xs font-semibold px-3 h-7 rounded-full bg-[#121212] text-[#fafafa] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {umbraBalanceStatus === "loading" ? "Revealing…" : "Reveal"}
                        </motion.button>
                      ) : (
                        <motion.button
                          onClick={handleOpenUnlock}
                          disabled={
                            !umbraBalanceBaseUnits ||
                            umbraBalanceBaseUnits === BigInt(0)
                          }
                          whileTap={{ scale: 0.98 }}
                          className="text-xs font-semibold px-3 h-7 rounded-full bg-[#121212] text-[#fafafa] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          Unlock
                        </motion.button>
                      )}
                    </div>
                    {umbraBalanceStatus === "needs-reveal" && (
                      <p className="text-[#121212]/40 text-[11px] mt-2">
                        Tap Reveal to view your shielded balance (one signature).
                      </p>
                    )}
                    {umbraBalanceStatus === "error" && umbraBalanceError && (
                      <p className="text-[#CB0000] text-xs mt-2 break-words">
                        Balance fetch failed: {umbraBalanceError.split("\n")[0]}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-2 border-t border-[#121212]/10 pt-4">
                <div className="flex justify-between">
                  <span className="text-[#121212] text-sm font-medium">Sent</span>
                  <span className="text-[#121212] text-sm font-medium">
                    {formatNumber(stats?.total_sent || 0)} USDC
                  </span>
                </div>
                <div className="flex justify-between pl-3">
                  <span className="text-[#121212]/50 text-xs">Direct</span>
                  <span className="text-[#121212]/50 text-xs">
                    {formatNumber(stats?.sent_direct || 0)} USDC
                  </span>
                </div>
                <div className="flex justify-between pl-3">
                  <span className="text-[#121212]/50 text-xs">Via Claim</span>
                  <span className="text-[#121212]/50 text-xs">
                    {formatNumber(stats?.sent_claim || 0)} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#121212] text-sm font-medium">Received</span>
                  <span className="text-[#121212] text-sm font-medium">
                    {formatNumber(stats?.total_received || 0)} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#121212] text-sm font-medium">Requested</span>
                  <span className="text-[#121212] text-sm font-medium">
                    {formatNumber(stats?.total_requested || 0)} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#121212] text-sm font-medium">Claimed</span>
                  <span className="text-[#121212] text-sm font-medium">
                    {formatNumber(stats?.total_claimed || 0)} USDC
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <motion.button
                  onClick={() => setShowAddFunds(true)}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold cursor-pointer shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
                >
                  Deposit
                </motion.button>
                <motion.button
                  onClick={() => setShowWithdraw(true)}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold cursor-pointer shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
                >
                  Withdraw
                </motion.button>
                {isXUser && (
                  <motion.button
                    onClick={() => exportWallet({ address: walletAddress || "" })}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 h-10 border border-[#121212]/20 rounded-full flex items-center justify-center text-[#121212] font-semibold hover:bg-[#121212]/5 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
                  >
                    Export
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "activity" && (
            <motion.div
              key="activity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-[320px] h-111.25 overflow-y-auto overflow-x-hidden"
            >
              {allActivities.length === 0 ? (
                <p className="text-[#121212]/50 text-sm text-center py-8">
                  No activity yet
                </p>
              ) : (
                <div className="space-y-2">
                  {allActivities.map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      activity={activity}
                      walletAddress={walletAddress}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showAddFunds && walletAddress && (
        <AddFundsModal
          isOpen={showAddFunds}
          onClose={() => {
            setShowAddFunds(false);
            refreshBalances();
          }}
          walletAddress={walletAddress}
        />
      )}

      {showWithdraw && walletAddress && (
        <WithdrawModal
          isOpen={showWithdraw}
          onClose={() => {
            setShowWithdraw(false);
            refreshBalances();
          }}
          usdcBalance={usdcBalance || 0}
          getSignature={getSignature}
        />
      )}

      {showUnlock && (
        <UnlockModal
          isOpen={showUnlock}
          onClose={() => {
            setShowUnlock(false);
            refetchUmbraBalance();
            refetchUSDCBalance();
          }}
          availableUSDC={umbraBalanceUSDC || 0}
          availableBaseUnits={umbraBalanceBaseUnits || BigInt(0)}
          hasPending={umbraHasPending}
          onSuccess={() => {
            refetchUmbraBalance();
            refetchUSDCBalance();
          }}
        />
      )}
    </>
  );
}
