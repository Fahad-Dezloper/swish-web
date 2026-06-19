"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useSessionSignature } from "@/hooks/useSessionSignature";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useUserRegistration } from "@/hooks/useUserRegistration";
import { useUserActivity } from "@/hooks/useUserActivity";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";
import {
  ActionButton,
  ActivityItem,
  AccountChip,
  Spinner,
  SendModal,
  ReceiveModal,
} from "@/components";

type ModalType = "send" | "receive" | null;

export default function Home() {
  const { ready, login, authenticated } = usePrivy();
  const { walletAddress, getSignature } = useSessionSignature();
  useUserRegistration();
  const { balance, refetch: refetchUSDCBalance } =
    useUSDCBalance(walletAddress);
  const {
    activities,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useUserActivity(walletAddress);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const mountedModal = useDelayedUnmount(activeModal, 350);
  const [animate, setAnimate] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const prevMainTop = useRef<number | null>(null);
  const prevAuthed = useRef(authenticated);

  useEffect(() => {
    if (ready) setAnimate(true);
  }, [ready]);

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

  const closeModal = () => {
    refetchUSDCBalance();
    refetchActivity();
    setActiveModal(null);
  };

  const recentActivities = activities.slice(0, 4);

  const TRANSITION = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <>
      <main
        ref={mainRef}
        className="relative flex flex-col items-center p-4 w-full"
      >
        <h1 className="text-3xl font-semibold text-[#121212] text-center leading-tight mb-8">
          Send. Request. Claim.
          <br />
          <span className="text-[#121212]/40">Privately.</span>
        </h1>

        {ready && (
          <AnimatePresence mode="popLayout" initial={false}>
            {!authenticated ? (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={TRANSITION}
                className="w-full max-w-[320px] flex flex-col items-center"
              >
              <p className="text-sm text-[#121212]/50 mb-8 text-center leading-relaxed">
                <span className="text-[#121212]/60 font-medium">
                  Private payments
                </span>{" "}
                on Solana.
                <br />
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
            <motion.div
              key="wallet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION}
              className="w-full max-w-[320px] flex flex-col items-center"
            >
              <div className="w-full mb-8">
                <AccountChip />
              </div>

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
