"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "swish_intro_seen_v1";

export function IntroOverlay() {
  // Start hidden so returning visitors never see a flash; flip on after
  // mount once we've checked localStorage.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setShow(true);
      }
    } catch {
      // localStorage blocked (private mode / sandbox) — skip intro silently
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{
            opacity: { duration: 0.25 },
            y: { type: "spring", damping: 30, stiffness: 180 },
          }}
          className="absolute left-0 right-0 bottom-0 top-1/3 z-40"
        >
          {/* Faded background — masked so the top edge dissolves into the page */}
          <div
            className="absolute inset-0 bg-[#fafafa]"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0, black 140px)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0, black 140px)",
            }}
          />

          {/* Content (above the masked bg, no fade) */}
          <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
            <h1 className="text-3xl font-semibold text-[#121212] leading-tight">
              Send. Receive. Claim.
              <br />
              Privately.
            </h1>
            <p className="mt-3 text-sm text-[#121212]/60 max-w-[280px] leading-relaxed">
              Swish picks the best route.
            </p>

            <motion.button
              onClick={handleDismiss}
              whileTap={{ scale: 0.98 }}
              className="mt-8 w-full max-w-[280px] h-11 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Get started
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
