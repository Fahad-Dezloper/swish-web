"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey } from "@solana/web3.js";

import { useSendTransaction } from "@/hooks/useSendTransaction";
import { useSessionSignature } from "@/hooks/useSessionSignature";
import { isProviderDisabled } from "@/lib/providers/maintenance";
import type { ProviderId } from "@/lib/providers/types";
import {
  PLUG_MSG,
  parsePlugConfigFromParams,
  type PlugConfig,
} from "@/lib/plug/types";
import Image from "next/image";
import { Spinner, AmountField } from "@/components";

type Phase =
  | "init" // parsing config
  | "connect" // wallet not connected
  | "review" // entering details / ready to pay
  | "processing"
  | "success"
  | "error";

// Post a typed message to the host page. We use "*" as targetOrigin: the
// payload carries no secrets (success = a public tx signature + the
// integrator's own reference), and the host filters by message type.
function postToHost(msg: unknown) {
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage(msg, "*");
  }
}

/** v1 takes a plain Solana address — no @handle / X resolution. */
function isValidAddress(addr: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

export function PlugWidget() {
  const params = useSearchParams();
  const { ready, connectWallet, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { send } = useSendTransaction();

  // Session sigs for the two v1 rails. PC uses its sig as an encryption key
  // (load-bearing); MB needs its own message validated server-side.
  const { getSignature: getPcSig, walletAddress: senderAddress } =
    useSessionSignature("privacy-cash");
  const { getSignature: getMbSig } = useSessionSignature("magicblock-per");

  const [config, setConfig] = useState<PlugConfig | null>(null);
  const [phase, setPhase] = useState<Phase>("init");
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const connectedWallet = wallets[0] || null;

  // --- 1. Load config: URL params first, postMessage as a fallback/override ---
  useEffect(() => {
    if (!params) return;
    const fromParams = parsePlugConfigFromParams(
      new URLSearchParams(params.toString())
    );
    setConfig(fromParams);
    if (fromParams.amount != null) setAmount(String(fromParams.amount));
    if (fromParams.recipient) setRecipient(fromParams.recipient);
    // Announce readiness so a host using postMessage config can respond.
    postToHost({ type: PLUG_MSG.READY });
  }, [params]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== PLUG_MSG.CONFIG || !data.config) return;
      const cfg = data.config as PlugConfig;
      setConfig(cfg);
      if (cfg.amount != null) setAmount(String(cfg.amount));
      if (cfg.recipient) setRecipient(cfg.recipient);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // --- 2. Drive the phase machine from config + auth state ---
  // Every field is optional: the Plug opens as a private-pay form and the
  // payer fills in whatever the integrator didn't preset. No dead-end state.
  useEffect(() => {
    if (!ready) return;
    if (phase === "processing" || phase === "success" || phase === "error")
      return;
    if (!config) {
      setPhase("init");
      return;
    }
    // Gate on a CONNECTED WALLET, not Privy `authenticated` — connectWallet()
    // attaches an external wallet without a full Privy login, so `authenticated`
    // stays false while wallets[0] is present and able to sign.
    setPhase(connectedWallet ? "review" : "connect");
  }, [ready, connectedWallet, config, phase]);

  // Are we inside an iframe (the SDK draws the modal chrome) or top-level
  // (redirect / direct view, where we center the card ourselves)?
  const [embedded, setEmbedded] = useState(true);
  useEffect(() => {
    setEmbedded(window.parent !== window);
  }, []);

  // Report content height to the host so the SDK can size the iframe to the
  // card (centered dialog on desktop, bottom sheet on mobile).
  const rootRef = useRef<HTMLDivElement>(null);
  const reportHeight = useCallback(() => {
    const el = rootRef.current;
    if (el) postToHost({ type: PLUG_MSG.RESIZE, height: el.scrollHeight });
  }, []);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => reportHeight());
    ro.observe(el);
    return () => ro.disconnect();
  }, [reportHeight]);
  // Belt-and-suspenders: re-measure on every content/phase change (after paint),
  // so the host always lands on the final height even if the observer races.
  useEffect(() => {
    const id = requestAnimationFrame(reportHeight);
    return () => cancelAnimationFrame(id);
  }, [reportHeight, phase, amount, recipient, error, ready, embedded]);

  const numAmount = useMemo(() => parseFloat(amount) || 0, [amount]);
  const amountLocked = config?.amount != null;
  const recipientLocked = !!config?.recipient;
  const effectiveRecipient = (config?.recipient || recipient).trim();
  const canPay =
    phase === "review" && numAmount > 0 && effectiveRecipient.length > 0;

  const handleConnect = useCallback(async () => {
    try {
      // Prefer a pure wallet connect; fall back to the login modal if the
      // installed Privy build doesn't expose connectWallet.
      if (typeof connectWallet === "function") {
        await connectWallet();
      } else {
        login();
      }
    } catch {
      // user dismissed — stay on the connect screen
    }
  }, [connectWallet, login]);

  // v1 routing: Auto over MB/PC only (Umbra slots in later). Ask the router
  // for its pick, but never dispatch to Umbra from the widget — fall back to
  // the preferred enabled rail (MB > PC) so a payer with an unregistered
  // external wallet is never dragged into Umbra's registration flow.
  const resolveRoute = useCallback(
    async (sender: string, receiver: string): Promise<ProviderId> => {
      let picked: ProviderId | null = null;
      try {
        const res = await fetch(
          `/api/router/preview?flow=send&sender=${encodeURIComponent(
            sender
          )}&receiver=${encodeURIComponent(receiver)}`
        );
        if (res.ok) {
          const json = (await res.json()) as { providerId?: ProviderId };
          picked = json.providerId ?? null;
        }
      } catch {
        // fall through to the explicit MB>PC choice below
      }
      if (picked === "magicblock-per" || picked === "privacy-cash") return picked;
      // Umbra (or no pick): choose MB unless disabled, else PC.
      if (!isProviderDisabled("magicblock-per")) return "magicblock-per";
      return "privacy-cash";
    },
    []
  );

  const handlePay = useCallback(async () => {
    if (!config || !connectedWallet || !effectiveRecipient) return;
    setPhase("processing");
    setError(null);
    try {
      const receiver = effectiveRecipient;
      if (!isValidAddress(receiver)) {
        throw new Error("Enter a valid Solana address");
      }
      const sender = senderAddress || connectedWallet.address;
      const providerId = await resolveRoute(sender, receiver);

      const session =
        providerId === "magicblock-per" ? await getMbSig() : await getPcSig();
      if (!session) throw new Error("Signature required to continue");

      const result = await send({
        receiverAddress: receiver,
        amount: numAmount,
        token: "USDC",
        signature: session.signature,
        senderPublicKey: session.address,
        providerId,
      });

      const sig = result.withdrawTx || result.depositTx;
      setTxSignature(sig);
      setPhase("success");

      postToHost({
        type: PLUG_MSG.SUCCESS,
        txSignature: sig,
        reference: config.reference,
      });

      // Hosted-checkout / redirect surface: bounce the top window back.
      if (config.returnUrl) {
        const url = new URL(config.returnUrl);
        url.searchParams.set("status", "success");
        url.searchParams.set("signature", sig);
        if (config.reference) url.searchParams.set("reference", config.reference);
        window.top?.location.assign(url.toString());
      }
    } catch (err: any) {
      const message = err?.message || "Payment failed";
      setError(message);
      setPhase("error");
      postToHost({ type: PLUG_MSG.ERROR, message });
    }
  }, [
    config,
    connectedWallet,
    effectiveRecipient,
    resolveRoute,
    senderAddress,
    getMbSig,
    getPcSig,
    send,
    numAmount,
  ]);

  const handleDisconnect = useCallback(async () => {
    try {
      // External (connect-only) wallets expose their own disconnect; fall back
      // to a full Privy logout for embedded/authenticated sessions.
      const w: any = connectedWallet;
      if (w && typeof w.disconnect === "function") {
        await w.disconnect();
      } else {
        await logout();
      }
    } catch {
      // ignore — phase machine returns to "connect" when the wallet clears
    }
  }, [connectedWallet, logout]);

  const handleClose = useCallback(() => {
    postToHost({ type: PLUG_MSG.CLOSE });
  }, []);

  const shortAddr = connectedWallet
    ? `${connectedWallet.address.slice(0, 4)}…${connectedWallet.address.slice(-4)}`
    : null;

  // --- render ---
  // The route renders ONLY the card content and fills the iframe. The SDK draws
  // the modal chrome (dim backdrop + centered dialog on desktop / bottom sheet
  // on mobile) and sizes the iframe to the height we report. When opened
  // top-level (direct/redirect, not embedded) we center the card ourselves.
  return (
    <div
      ref={rootRef}
      className={
        embedded
          ? "w-full bg-[#fafafa] text-[#121212] flex flex-col"
          : "w-full max-w-107.5 mx-auto mt-10 bg-[#fafafa] text-[#121212] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Image
            src="/assets/logo.svg"
            alt="Swish"
            width={26}
            height={14}
            className="h-3.5 w-auto"
          />
          <h2 className="text-2xl font-semibold text-[#121212]">Deposit</h2>
        </div>
        <button
          onClick={handleClose}
          aria-label="Close"
          className="text-[#121212]/40 hover:text-[#121212] text-xl leading-none"
        >
          ✕
        </button>
      </div>

      <div className="px-6 pb-6">
        {(phase === "init" || !ready) && (
          <div className="py-10 flex justify-center">
            <Spinner />
          </div>
        )}

        {(phase === "connect" ||
          phase === "review" ||
          phase === "processing" ||
          phase === "error") &&
          config && (
            <div>
              {/* Connected wallet / disconnect */}
              {shortAddr && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={handleDisconnect}
                    disabled={phase === "processing"}
                    className="flex items-center gap-1.5 text-xs text-[#121212]/50 hover:text-[#121212] disabled:opacity-40 transition-colors"
                    title="Disconnect wallet"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#008834]" />
                    {shortAddr}
                    <span className="opacity-60">· Disconnect</span>
                  </button>
                </div>
              )}

              {/* Amount */}
              <div className="mb-4">
                {amountLocked ? (
                  <AmountField amount={amount || "0"} assetSymbol="USDC" />
                ) : (
                  <div className="flex items-center gap-3 bg-[#121212]/[0.04] rounded-full p-2 h-16">
                    <div className="flex items-center justify-center bg-[#fafafa] rounded-full p-1.5 shrink-0 shadow-[0_1px_3px_rgba(18,18,18,0.08)]">
                      <Image
                        src="/assets/usdc-icon.svg"
                        alt="USDC"
                        width={26}
                        height={26}
                      />
                    </div>
                    <div className="flex-1 flex items-baseline gap-1.5 min-w-0">
                      <input
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                        }
                        placeholder="0"
                        disabled={phase === "processing"}
                        className="w-full text-2xl font-medium text-[#121212] bg-transparent outline-none min-w-0 placeholder:text-[#121212]/30"
                      />
                      <span className="text-2xl font-medium text-[#121212]/30 whitespace-nowrap">
                        USDC
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div className="mb-5">
                <label className="text-sm text-[#121212]/50 mb-1 block">
                  {recipientLocked ? "Depositing to" : "Recipient wallet address"}
                </label>
                <input
                  type="text"
                  value={recipientLocked ? config.recipient : recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  disabled={recipientLocked || phase === "processing"}
                  placeholder="Solana address"
                  spellCheck={false}
                  autoCapitalize="none"
                  className="w-full h-12 px-4 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors disabled:opacity-70 truncate"
                />
              </div>

              {error && phase === "error" && (
                <p className="text-sm text-[#CB0000] text-center mb-3">{error}</p>
              )}

              {phase === "connect" && (
                <button
                  onClick={handleConnect}
                  className="w-full h-12 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
                >
                  Connect wallet
                </button>
              )}

              {(phase === "review" || phase === "error") && (
                <button
                  onClick={handlePay}
                  disabled={!canPay}
                  className="w-full h-12 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
                >
                  Deposit{numAmount > 0 ? ` $${numAmount}` : ""} USDC
                </button>
              )}

              {phase === "processing" && (
                <button
                  disabled
                  className="w-full h-12 bg-[#121212]/70 rounded-full flex items-center justify-center gap-2 text-[#fafafa] font-semibold"
                >
                  <Spinner /> Depositing…
                </button>
              )}

              <p className="text-[11px] text-center text-[#121212]/40 leading-snug mt-4">
                You need SOL for gas + USDC in your wallet. Powered by Swish —
                Privacy, made simple.
              </p>
            </div>
          )}

        {phase === "success" && (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#008834] text-white flex items-center justify-center text-2xl">
              ✓
            </div>
            <p className="font-semibold text-[#121212]">Deposited privately</p>
            {txSignature && (
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#008834] underline break-all block"
              >
                View transaction
              </a>
            )}
            <button
              onClick={handleClose}
              className="w-full h-12 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold mt-2 shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
