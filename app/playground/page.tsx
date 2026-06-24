"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "motion/react";

/**
 * The Plug playground — `plug.swish.cash/`.
 *
 * A dev landing page: configure a Plug, try the real button + modal live, and
 * copy the snippet. The live preview loads the vanilla loader (`/plug.js`) from
 * this same origin and points it at this origin's `/plug` iframe, so it works
 * both locally (localhost:3000) and in prod (plug.swish.cash) with no config.
 *
 * Styled to match the main Swish app shell: light #fafafa surface, dark
 * #121212 text, the muted-second-line headline, and the app's pill buttons.
 */

interface PlugOpenOpts {
  recipient?: string;
  amount?: number;
  label?: string;
  reference?: string;
  baseUrl?: string;
  onSuccess?: (txSignature: string, reference?: string) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    Plug?: { open: (opts: PlugOpenOpts) => void };
  }
}

/** The Swish "swish" mark, stroked with currentColor. */
function SwishMark({ size = 18 }: { size?: number }) {
  const width = Math.round(size * (289 / 148));
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 289 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M24.0052 24.0052L60.2824 96.5595C62.1139 100.223 66.9958 101.015 69.8916 98.1189L98.6645 69.346C101.395 66.6152 105.957 67.138 107.999 70.4157L139.349 120.73C141.713 124.524 147.247 124.493 149.569 120.673L180.038 70.5344C182.057 67.2105 186.657 66.6574 189.408 69.4077L218.119 98.1189C221.015 101.015 225.897 100.223 227.728 96.5595L264.005 24.0052"
        stroke="currentColor"
        strokeWidth={48}
        strokeMiterlimit="3.99393"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Copy / check icons — same SVGs the app's profile uses, stroked w/ currentColor. */
function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5.5 1H12.6C14.8402 1 15.9603 1 16.816 1.43597C17.5686 1.81947 18.1805 2.43139 18.564 3.18404C19 4.03969 19 5.15979 19 7.4V14.5M4.2 19H12.3C13.4201 19 13.9802 19 14.408 18.782C14.7843 18.5903 15.0903 18.2843 15.282 17.908C15.5 17.4802 15.5 16.9201 15.5 15.8V7.7C15.5 6.57989 15.5 6.01984 15.282 5.59202C15.0903 5.21569 14.7843 4.90973 14.408 4.71799C13.9802 4.5 13.4201 4.5 12.3 4.5H4.2C3.0799 4.5 2.51984 4.5 2.09202 4.71799C1.71569 4.90973 1.40973 5.21569 1.21799 5.59202C1 6.01984 1 6.57989 1 7.7V15.8C1 16.9201 1 17.4802 1.21799 17.908C1.40973 18.2843 1.71569 18.5903 2.09202 18.782C2.51984 19 3.0799 19 4.2 19Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ height = 9 }: { height?: number }) {
  const width = Math.round(height * (19 / 10));
  return (
    <svg width={width} height={height} viewBox="0 0 19 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2.00024 2.44654L5.14705 7.84107" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      <path d="M5.26953 7.86023L16.2727 2.00041" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

export default function PlaygroundPage() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [tab, setTab] = useState<"react" | "script">("react");
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  // Mark ready once the loader is on window (covers cached/fast loads too).
  useEffect(() => {
    if (typeof window !== "undefined" && window.Plug) setReady(true);
  }, []);

  const numAmount = amount.trim() === "" ? undefined : Number(amount);
  const labelText = label.trim() || "Deposit Privately";

  // Origin the preview iframe loads from. Normally this page's own origin —
  // but `plug.localhost` isn't a Privy-trusted secure context (only exact
  // `localhost` is), so locally we point the iframe at plain `localhost`. That
  // also makes the preview a true cross-origin embed, like a real integration.
  function previewBaseUrl(): string {
    const { hostname, port, origin } = window.location;
    if (hostname.endsWith(".localhost")) {
      return `http://localhost${port ? `:${port}` : ""}`;
    }
    return origin;
  }

  function openPreview() {
    if (typeof window === "undefined" || !window.Plug) return;
    window.Plug.open({
      recipient: recipient.trim() || undefined,
      amount: numAmount != null && !Number.isNaN(numAmount) ? numAmount : undefined,
      label: label.trim() || undefined,
      reference: "playground_demo",
      baseUrl: previewBaseUrl(),
      onSuccess: (sig, ref) => setLastEvent(`onSuccess — ${sig.slice(0, 12)}… (ref: ${ref ?? "—"})`),
      onError: (m) => setLastEvent(`onError — ${m}`),
      onClose: () => setLastEvent("onClose"),
    });
  }

  // --- live snippet generation -------------------------------------------
  const reactSnippet = useMemo(() => {
    const props: string[] = [];
    if (recipient.trim()) props.push(`  recipient="${recipient.trim()}"`);
    if (numAmount != null && !Number.isNaN(numAmount)) props.push(`  amount={${numAmount}}`);
    if (label.trim()) props.push(`  label="${label.trim()}"`);
    props.push(`  reference="order_1234"`);
    props.push(`  onSuccess={(sig, ref) => markOrderPaid(ref)}`);
    return (
      `import { Plug } from "@swishdotcash/plug";\n\n` +
      `<Plug\n${props.join("\n")}\n/>`
    );
  }, [recipient, numAmount, label]);

  const scriptSnippet = useMemo(() => {
    const opts: string[] = [];
    if (recipient.trim()) opts.push(`    recipient: "${recipient.trim()}",`);
    if (numAmount != null && !Number.isNaN(numAmount)) opts.push(`    amount: ${numAmount},`);
    if (label.trim()) opts.push(`    label: "${label.trim()}",`);
    opts.push(`    reference: "order_1234",`);
    opts.push(`    onSuccess: function (sig, ref) { markOrderPaid(ref); },`);
    return (
      `<script src="https://plug.swish.cash/plug.js"></script>\n` +
      `<button onclick="Plug.open({\n${opts.join("\n")}\n})">\n  ${labelText}\n</button>`
    );
  }, [recipient, numAmount, label, labelText]);

  const snippet = tab === "react" ? reactSnippet : scriptSnippet;

  function copySnippet() {
    navigator.clipboard?.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const labelClass = "text-sm text-[#121212]/50 mb-1.5 block";
  const optionalClass = "text-[#121212]/30";
  const inputClass =
    "w-full h-12 px-5 rounded-full border border-[#121212]/10 bg-white text-[#121212] outline-none focus:border-[#121212]/30 transition-colors placeholder:text-[#121212]/30";
  const cardClass =
    "bg-white border border-[#121212]/[0.07] rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(18,18,18,0.04)]";

  // Match the app's easing, with a gentle staggered fade-up on mount.
  const EASE = [0.22, 1, 0.36, 1] as const;
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#121212]">
      <Script src="/plug.js" strategy="afterInteractive" onLoad={() => setReady(true)} />

      {/* Cloudflare Web Analytics — separate plug.swish.cash property. Scoped to
          the playground page only (NOT the /plug widget iframe), so this counts
          demo visits, not embedded-widget impressions on partner sites. */}
      <Script
        src="https://static.cloudflareinsights.com/beacon.min.js"
        strategy="afterInteractive"
        data-cf-beacon='{"token": "087486ba52224631be8ad9023e8c7f70"}'
      />

      {/* Header — centered mark, matching the app shell. */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex justify-center pt-10 pb-2"
      >
        <span className="inline-flex items-center text-[#121212]">
          <SwishMark size={20} />
        </span>
      </motion.header>

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-xl mx-auto px-5 pt-10 pb-20"
      >
        {/* Hero — "The Plug" as the headline; tagline + description below. */}
        <motion.div variants={item} className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-[#121212]">
            The Plug
          </h1>
          <p className="mt-3 text-lg font-medium">
            <span className="text-[#121212]">Private USDC payments,</span>{" "}
            <span className="text-[#121212]/40">in one button.</span>
          </p>
        </motion.div>

        {/* Configure */}
        <motion.section variants={item} className={cardClass}>
          <h2 className="text-sm font-medium text-[#121212]/40 uppercase tracking-wide mb-5">
            Configure
          </h2>

          <label className={labelClass}>
            Recipient wallet address
            <span className={optionalClass}> · optional</span>
          </label>
          <input
            className={`${inputClass} mb-4 truncate`}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            placeholder="Solana address — omit to let the payer choose"
            spellCheck={false}
            autoCapitalize="none"
          />

          <label className={labelClass}>
            Amount (USDC)
            <span className={optionalClass}> · optional</span>
          </label>
          <input
            className={`${inputClass} mb-4`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="Locked if set — omit to let the payer type it"
          />

          <label className={labelClass}>
            Button label
            <span className={optionalClass}> · optional</span>
          </label>
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Deposit Privately"
          />
        </motion.section>

        {/* Live preview */}
        <motion.section variants={item} className={`${cardClass} mt-4`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-[#121212]/40 uppercase tracking-wide">
              Live preview
            </h2>
            <span className="text-xs text-[#121212]/40 truncate max-w-[55%] text-right">
              {lastEvent ? `Last event: ${lastEvent}` : "Click to try the flow"}
            </span>
          </div>

          <div className="flex items-center justify-center rounded-2xl bg-[#fafafa] border border-[#121212]/[0.06] py-14">
            <motion.button
              onClick={openPreview}
              disabled={!ready}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="inline-flex items-center gap-2 bg-[#121212] text-[#fafafa] rounded-full px-6 h-11 font-semibold hover:bg-[#121212]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(18,18,18,0.15)] whitespace-nowrap"
            >
              <SwishMark size={15} />
              {labelText}
            </motion.button>
          </div>
        </motion.section>

        {/* Snippet */}
        <motion.section variants={item} className={`${cardClass} mt-4`}>
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex rounded-full bg-[#121212]/[0.05] p-1">
              {(["react", "script"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 h-8 rounded-full text-sm font-medium transition-colors ${
                    tab === t
                      ? "bg-[#121212] text-[#fafafa]"
                      : "text-[#121212]/50 hover:text-[#121212]"
                  }`}
                >
                  {t === "react" ? "React" : "Script tag"}
                </button>
              ))}
            </div>
            <motion.button
              onClick={copySnippet}
              whileTap={{ scale: 0.9 }}
              aria-label={copied ? "Copied" : "Copy snippet"}
              className="inline-flex h-5 w-5 items-center justify-center text-[#121212]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    className="inline-flex"
                  >
                    <CheckIcon />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    className="inline-flex"
                  >
                    <CopyIcon />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {tab === "react" && (
            <p className="text-sm text-[#121212]/50 mb-3">
              <code className="px-1.5 py-0.5 rounded bg-[#121212]/[0.06] text-[#121212]">
                npm i @swishdotcash/plug
              </code>{" "}
              — <code className="text-[#121212]/70">react</code> is the only peer
              dependency.
            </p>
          )}

          <pre className="bg-[#1c1c1c] text-[#fafafa] rounded-2xl p-5 overflow-x-auto text-sm leading-relaxed">
            <code>{snippet}</code>
          </pre>

          <p className="text-xs text-[#121212]/50 mt-3 leading-relaxed">
            <span className="text-[#121212]/70 font-medium">recipient</span>,{" "}
            <span className="text-[#121212]/70 font-medium">amount</span>, and{" "}
            <span className="text-[#121212]/70 font-medium">reference</span> are
            all optional. Omit <span className="font-medium">recipient</span> to
            let the payer choose, <span className="font-medium">amount</span> to
            let them type it, and{" "}
            <span className="font-medium">reference</span> if you have no order
            to track — it&apos;s just your own order id, echoed back untouched in{" "}
            <span className="text-[#121212]/70 font-medium">onSuccess</span> so
            you can match a payment to your order.
          </p>
        </motion.section>

        {/* Footer */}
        <motion.footer
          variants={item}
          className="mt-10 flex items-center justify-center text-sm text-[#121212]/40"
        >
          <span>Non-custodial · No fees</span>
        </motion.footer>
      </motion.main>
    </div>
  );
}
