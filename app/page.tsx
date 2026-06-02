"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useSessionSignature } from "@/hooks/useSessionSignature";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useSOLBalance } from "@/hooks/useSOLBalance";
import { useUserRegistration } from "@/hooks/useUserRegistration";
import { useUserActivity } from "@/hooks/useUserActivity";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";
import { formatNumber } from "@/utils";
import {
  ActionButton,
  ActivityItem,
  Spinner,
  SendModal,
  ReceiveModal,
} from "@/components";

type ModalType = "send" | "receive" | null;

export default function Home() {
  const { ready, login, authenticated, logout, user } = usePrivy();
  const { walletAddress, getSignature } = useSessionSignature();
  useUserRegistration();
  const {
    balance,
    isLoading: balanceLoading,
    refetch: refetchUSDCBalance,
  } = useUSDCBalance(walletAddress);
  const { balance: solBalance, balanceUSD: solBalanceUSD } =
    useSOLBalance(walletAddress);
  const {
    activities,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useUserActivity(walletAddress);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const mountedModal = useDelayedUnmount(activeModal, 350);
  const [showAccount, setShowAccount] = useState(false);
  const [copied, setCopied] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  // Gate slide/fade animations until Privy resolves, so a logged-in user
  // doesn't see the intro→wallet slide play on every page load.
  const [animate, setAnimate] = useState(false);
  // FLIP refs: Framer's `layout` doesn't fire through the centered grandparent
  // (verified — it teleports), so we slide the block by measuring its real
  // before/after position and easing the exact delta via the Web Animations API.
  const mainRef = useRef<HTMLElement>(null);
  const prevMainTop = useRef<number | null>(null);
  const prevAuthed = useRef(authenticated);

  const isXUser = !!user?.twitter;
  const twitterHandle = user?.twitter?.username;

  // Close the account dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccount(false);
      }
    };
    if (showAccount) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccount]);

  useEffect(() => {
    // One-time once Privy resolves: enables the connect/disconnect slide so
    // the initial load snaps into place and only real transitions animate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready) setAnimate(true);
  }, [ready]);

  // FLIP slide on connect/disconnect. Runs after every render to keep the
  // last position fresh, but only animates when `authenticated` actually
  // flipped (not on balance/activity re-renders).
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const newTop = el.getBoundingClientRect().top;
    if (
      animate &&
      prevAuthed.current !== authenticated &&
      prevMainTop.current !== null
    ) {
      const delta = prevMainTop.current - newTop;
      if (Math.abs(delta) > 1) {
        el.animate(
          [
            { transform: `translateY(${delta}px)` },
            { transform: "translateY(0px)" },
          ],
          { duration: 400, easing: "cubic-bezier(0.22,1,0.36,1)" }
        );
      }
    }
    prevMainTop.current = newTop;
    prevAuthed.current = authenticated;
  });

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const formatAddr = (addr: string) =>
    addr.length <= 10 ? addr : `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const closeModal = () => {
    refetchUSDCBalance();
    refetchActivity();
    setActiveModal(null);
  };

  const recentActivities = activities.slice(0, 4);

  // Shared easing for the headline slide + content fade so they feel like
  // one motion.
  const TRANSITION = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

  // Account total across assets (USD). Split so the cents render muted.
  const totalUSD = (balance ?? 0) + (solBalanceUSD ?? 0);
  const [totalWhole, totalCents] = totalUSD.toFixed(2).split(".");

  // Asset list for the expanded account panel — add a row here per asset
  // as more land (SOL backend is Phase 2).
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
    <>
      {/* FLIP-slid via the useLayoutEffect above (Framer `layout` teleports
          through the centered grandparent). The whole block glides; content
          crossfades. */}
      <main
        ref={mainRef}
        className="relative flex flex-col items-center p-4 w-full"
      >
        {/* Persistent hero — the product in three verbs. */}
        <h1 className="text-3xl font-semibold text-[#121212] text-center leading-tight mb-8">
          Send. Request. Claim.
          <br />
          Privately.
        </h1>

        {ready && (
          <AnimatePresence mode="popLayout" initial={false}>
            {!authenticated ? (
              // Empty / not-connected state: the whole intro.
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={TRANSITION}
                className="w-full max-w-[320px] flex flex-col items-center"
              >
              <p className="text-sm text-[#121212]/60 mb-8 text-center">
                Swish picks the best route.
              </p>
              <motion.button
                onClick={login}
                whileTap={{ scale: 0.98 }}
                className="w-full max-w-[280px] h-11 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
              >
                Get started
              </motion.button>
            </motion.div>
          ) : (
            // Connected: the action items fade in.
            <motion.div
              key="wallet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION}
              className="w-full max-w-[320px] flex flex-col items-center"
            >
              {/* Account — total collapsed; assets + wallet info expanded */}
              <div className="relative w-full mb-8" ref={accountRef}>
                <button
                  onClick={() => setShowAccount((prev) => !prev)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl hover:bg-[#121212]/[0.03] transition-colors"
                >
                  <span className="text-3xl font-semibold whitespace-nowrap">
                    {balanceLoading && balance === null ? (
                      <span className="text-[#121212]/40">…</span>
                    ) : (
                      <>
                        <span className="text-[#121212]">${totalWhole}</span>
                        <span className="text-[#121212]/40">.{totalCents}</span>
                      </>
                    )}
                  </span>
                  <Image
                    src="/assets/chevron-down-icon.svg"
                    alt=""
                    width={14}
                    height={14}
                    className={`transition-transform ${showAccount ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {showAccount && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[#fafafa] border border-[#121212]/10 rounded-2xl shadow-lg z-50 overflow-hidden"
                    >
                      {/* Assets */}
                      {assets.map((asset) => (
                        <div
                          key={asset.symbol}
                          className="px-4 py-3 flex items-center gap-3"
                        >
                          <Image
                            src={asset.icon}
                            alt={asset.symbol}
                            width={28}
                            height={28}
                          />
                          <div className="flex-1 min-w-0 text-left leading-tight">
                            <div className="text-[#121212] text-sm font-medium">
                              {asset.symbol}
                            </div>
                            <div className="text-[#121212]/40 text-xs mt-0.5">
                              {asset.native}
                            </div>
                          </div>
                          <div className="text-[#121212] text-sm font-medium">
                            ${asset.usd.toFixed(2)}
                          </div>
                        </div>
                      ))}

                      {/* Separator */}
                      <div className="h-px bg-[#121212]/[0.08] mx-4" />

                      {/* Wallet Address */}
                      <button
                        onClick={copied ? undefined : handleCopyAddress}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 transition-colors ${copied ? "pointer-events-none" : "hover:bg-[#121212]/5"}`}
                      >
                        <Image
                          src="/assets/sol-icon.svg"
                          alt=""
                          width={16}
                          height={16}
                        />
                        <span className="text-[#121212] text-md flex-1 text-left">
                          {walletAddress ? formatAddr(walletAddress) : ""}
                        </span>
                        <Image
                          src={
                            copied
                              ? "/assets/success-alt.svg"
                              : "/assets/copy-icon.svg"
                          }
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
                          <Image
                            src="/assets/x-icon.svg"
                            alt=""
                            width={16}
                            height={16}
                          />
                          <span className="text-[#121212]/60 text-sm">
                            @{twitterHandle}
                          </span>
                        </a>
                      )}

                      {/* Logout */}
                      <button
                        onClick={() => {
                          setShowAccount(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#121212]/5 transition-colors"
                      >
                        <Image
                          src="/assets/logout-icon.svg"
                          alt=""
                          width={16}
                          height={16}
                        />
                        <span className="text-[#121212] text-sm">Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex gap-4 mb-10">
                <div className="flex-1">
                  <ActionButton
                    variant="send"
                    onClick={() => setActiveModal("send")}
                  />
                </div>
                <div className="flex-1">
                  <ActionButton
                    variant="receive"
                    onClick={() => setActiveModal("receive")}
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#121212] text-sm font-medium">
                    Recent activity
                  </span>
                  {recentActivities.length > 0 && (
                    <Link
                      href="/p?tab=activity"
                      className="text-[#121212]/50 text-xs hover:text-[#121212] transition-colors"
                    >
                      See all
                    </Link>
                  )}
                </div>

                {/* Reserved height so the spinner→rows swap doesn't change
                    the block's height and re-target the headline mid-slide. */}
                <div className="min-h-[184px]">
                  {activityLoading && recentActivities.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <Spinner size={24} color="#121212" />
                    </div>
                  ) : recentActivities.length === 0 ? (
                    <p className="text-[#121212]/50 text-sm text-center py-8">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentActivities.map((activity) => (
                        <ActivityItem
                          key={activity.id}
                          activity={activity}
                          walletAddress={walletAddress}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        )}
      </main>

      {/* Modals - only render when active to avoid multiple hook instances.
          `mountedModal` lingers ~350ms past close so Modal's exit animation
          can play before the component is unmounted. */}
      {mountedModal === "send" && (
        <SendModal
          isOpen={activeModal === "send"}
          onClose={closeModal}
          balance={balance}
          getSignature={getSignature}
        />
      )}

      {mountedModal === "receive" && (
        <ReceiveModal
          isOpen={activeModal === "receive"}
          onClose={closeModal}
          getSignature={getSignature}
        />
      )}
    </>
  );
}
