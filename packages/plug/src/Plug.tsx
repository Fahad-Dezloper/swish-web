import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PLUG_MSG, type PlugProps } from "./types";
import { SwishMark } from "./SwishMark";

const DEFAULT_BASE = "https://swish.cash";

// Below this trigger width we drop "Privately" and show just "Deposit".
const COMPACT_WIDTH = 150;

// Modal chrome: dim backdrop + centered dialog on desktop, slide-up bottom
// sheet on phones (the same shape as the Privy modal).
const MODAL_CSS =
  ".swish-plug-bd{position:fixed;inset:0;z-index:2147483647;background:rgba(18,18,18,.6);" +
  "display:flex;align-items:center;justify-content:center;padding:16px;animation:swishPlugFade .15s ease}" +
  ".swish-plug-fr{width:100%;max-width:400px;max-height:90vh;border:0;border-radius:24px;" +
  "background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
  "@keyframes swishPlugFade{from{opacity:0}to{opacity:1}}" +
  "@keyframes swishPlugUp{from{transform:translateY(100%)}to{transform:translateY(0)}}" +
  "@media (max-width:640px){.swish-plug-bd{align-items:flex-end;padding:0}" +
  ".swish-plug-fr{max-width:none;border-radius:20px 20px 0 0;" +
  "box-shadow:0 -8px 40px rgba(0,0,0,.35);animation:swishPlugUp .25s ease}}";

function buildSrc(baseUrl: string, props: PlugProps): string {
  const params = new URLSearchParams();
  if (props.recipient) params.set("recipient", props.recipient);
  if (props.amount != null) params.set("amount", String(props.amount));
  if (props.token) params.set("token", props.token);
  if (props.reference) params.set("reference", props.reference);
  return `${baseUrl.replace(/\/$/, "")}/plug?${params.toString()}`;
}

/**
 * <Plug /> — a branded "Deposit Privately" button that opens the Swish private
 * payment widget in a modal (ConnectKit-style). The heavy iframe only loads on
 * click. No Solana/Privy dependencies are bundled — all wallet + protocol
 * logic lives in the hosted route.
 *
 *   <Plug recipient="merchant.sol" amount={25} reference="order_1"
 *         onSuccess={(sig, ref) => markPaid(ref)} />
 *
 * Pass `children` to use your own trigger instead of the default button.
 */
export function Plug(props: PlugProps) {
  const {
    baseUrl = DEFAULT_BASE,
    label,
    compact,
    onSuccess,
    onError,
    onClose,
    children,
    className,
    style,
  } = props;

  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(520);
  const origin = useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const src = useMemo(() => buildSrc(baseUrl, props), [baseUrl, props]);

  // Keep the latest callbacks without re-subscribing the message listener.
  const handlers = useRef({ onSuccess, onError, onClose });
  handlers.current = { onSuccess, onError, onClose };

  // --- responsive label: auto-shrink "Deposit Privately" -> "Deposit" ---
  const btnRef = useRef<HTMLButtonElement>(null);
  const [autoCompact, setAutoCompact] = useState(false);
  useEffect(() => {
    if (compact !== undefined || label || children) return;
    const el = btnRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setAutoCompact(el.clientWidth < COMPACT_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, label, children]);

  const isCompact = compact ?? autoCompact;
  const text = label ?? (isCompact ? "Deposit" : "Deposit Privately");

  // --- iframe <-> modal bridge (only mounted while open) ---
  useEffect(() => {
    if (!open) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      const data = e.data;
      if (!data || typeof data.type !== "string") return;
      switch (data.type) {
        case PLUG_MSG.RESIZE:
          if (typeof data.height === "number" && data.height > 0) {
            setHeight(data.height);
          }
          break;
        case PLUG_MSG.SUCCESS:
          handlers.current.onSuccess?.(data.txSignature, data.reference);
          setOpen(false);
          break;
        case PLUG_MSG.ERROR:
          handlers.current.onError?.(data.message);
          break;
        case PLUG_MSG.CLOSE:
          handlers.current.onClose?.();
          setOpen(false);
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, origin]);

  // Custom trigger (render-prop escape hatch) or the default branded button.
  const trigger = children ? (
    <span onClick={() => setOpen(true)} style={{ display: "contents" }}>
      {children}
    </span>
  ) : (
    <button
      ref={btnRef}
      type="button"
      onClick={() => setOpen(true)}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#121212",
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: "12px 22px",
        fontSize: 15,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <SwishMark size={15} />
      {text}
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        // SDK draws the modal chrome (dim backdrop + centered dialog / mobile
        // bottom sheet); the iframe holds the card, sized to its content.
        <>
          <style>{MODAL_CSS}</style>
          <div
            className="swish-plug-bd"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handlers.current.onClose?.();
                setOpen(false);
              }
            }}
          >
            <iframe
              className="swish-plug-fr"
              src={src}
              title="Deposit privately with Swish"
              allow="clipboard-write; payment"
              style={{ height }}
            />
          </div>
        </>
      )}
    </>
  );
}
