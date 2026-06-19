"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";

/**
 * The Plug playground — `plug.swish.cash/`.
 *
 * A dev landing page: configure a Plug, try the real button + modal live, and
 * copy the snippet. The live preview loads the vanilla loader (`/plug.js`) from
 * this same origin and points it at this origin's `/plug` iframe, so it works
 * both locally (localhost:3000) and in prod (plug.swish.cash) with no config.
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
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const inputClass =
    "w-full h-12 px-4 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors placeholder:text-[#121212]/30";

  return (
    <div className="min-h-screen bg-[#121212] text-[#fafafa]">
      <Script src="/plug.js" strategy="afterInteractive" onLoad={() => setReady(true)} />

      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        {/* Hero */}
        <header className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-[#008834] mb-5">
            <SwishMark size={22} />
            <span className="text-sm font-medium tracking-wide uppercase text-[#fafafa]/50">
              The Plug · by Swish
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Private USDC payments,
            <br />
            in one button.
          </h1>
          <p className="mt-5 text-[#fafafa]/60 max-w-xl mx-auto text-lg">
            Drop the Plug into any site. Your users pay privately on Solana — no
            protocol plumbing, no custody, no fees. Configure it below and copy
            the snippet.
          </p>
        </header>

        {/* Configure + preview */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Configurator */}
          <section className="bg-[#fafafa] text-[#121212] rounded-3xl p-6 sm:p-7">
            <h2 className="text-lg font-medium mb-5">Configure</h2>

            <label className="text-sm text-[#121212]/50 mb-1 block">
              Recipient wallet address
              <span className="text-[#121212]/30"> · optional</span>
            </label>
            <input
              className={`${inputClass} mb-4 truncate`}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              placeholder="Solana address — omit to let the payer choose"
              spellCheck={false}
              autoCapitalize="none"
            />

            <label className="text-sm text-[#121212]/50 mb-1 block">
              Amount (USDC)
              <span className="text-[#121212]/30"> · optional</span>
            </label>
            <input
              className={`${inputClass} mb-4`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Locked if set — omit to let the payer type it"
            />

            <label className="text-sm text-[#121212]/50 mb-1 block">
              Button label
              <span className="text-[#121212]/30"> · optional</span>
            </label>
            <input
              className={inputClass}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Deposit Privately"
            />
          </section>

          {/* Live preview */}
          <section className="bg-[#fafafa] text-[#121212] rounded-3xl p-6 sm:p-7 flex flex-col">
            <h2 className="text-lg font-medium mb-1">Live preview</h2>
            <p className="text-sm text-[#121212]/50 mb-6">
              The real button + modal — click to try the flow.
            </p>

            <div className="flex-1 flex items-center justify-center rounded-2xl bg-[#121212]/[0.03] border border-dashed border-[#121212]/10 py-12">
              <button
                onClick={openPreview}
                disabled={!ready}
                className="inline-flex items-center gap-2 bg-[#121212] text-[#fafafa] rounded-full px-6 py-3 font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(18,18,18,0.15)] whitespace-nowrap"
              >
                <SwishMark size={15} />
                {labelText}
              </button>
            </div>

            <p className="text-xs text-center text-[#121212]/40 mt-4 h-4">
              {lastEvent ? `Last event: ${lastEvent}` : " "}
            </p>
          </section>
        </div>

        {/* Snippet */}
        <section className="mt-5 bg-[#fafafa] text-[#121212] rounded-3xl p-6 sm:p-7">
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
            <button
              onClick={copySnippet}
              className="text-sm font-medium text-[#008834] hover:opacity-80 transition-opacity"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
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
            <span className="text-[#121212]/70 font-medium">
              recipient
            </span>
            ,{" "}
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
        </section>

        {/* Footer */}
        <footer className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#fafafa]/40">
          <span className="inline-flex items-center gap-1.5">
            Powered by
            <a
              href="https://swish.cash"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#fafafa]/70 hover:text-[#fafafa] transition-colors"
            >
              <SwishMark size={13} /> Swish
            </a>
          </span>
          <span className="inline-flex items-center gap-4">
            <a href="https://swish.cash" target="_blank" rel="noreferrer" className="hover:text-[#fafafa]/70 transition-colors">
              swish.cash
            </a>
            <span className="text-[#fafafa]/20">·</span>
            <span>Non-custodial · No fees</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
