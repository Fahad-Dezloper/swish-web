/**
 * The Plug — Swish's embeddable private-payments widget (vanilla loader).
 *
 * Drop-in, zero dependencies:
 *
 *   <script src="https://swish.cash/plug.js"></script>
 *   <script>
 *     Plug.open({
 *       recipient: "merchant.sol",   // Solana address OR Swish @handle
 *       amount: 25.00,                // optional; omit to let the payer type it
 *       reference: "order_1234",      // your order id — echoed back verbatim
 *       onSuccess: function (txSignature, reference) { markPaid(reference); },
 *       onError:   function (message) { console.error(message); },
 *       onClose:   function () {},
 *     });
 *   </script>
 *
 * All wallet/protocol logic lives in the hosted iframe (swish.cash/plug);
 * this file just renders it and relays postMessage events.
 */
(function () {
  "use strict";

  var DEFAULT_BASE = "https://swish.cash";

  var MSG = {
    READY: "swish:plug:ready",
    CONFIG: "swish:plug:config",
    RESIZE: "swish:plug:resize",
    SUCCESS: "swish:plug:success",
    ERROR: "swish:plug:error",
    CLOSE: "swish:plug:close",
  };

  function buildSrc(baseUrl, opts) {
    var params = new URLSearchParams();
    if (opts.recipient) params.set("recipient", opts.recipient);
    if (opts.amount != null) params.set("amount", String(opts.amount));
    if (opts.token) params.set("token", opts.token);
    if (opts.reference) params.set("reference", opts.reference);
    if (opts.returnUrl) params.set("returnUrl", opts.returnUrl);
    return baseUrl.replace(/\/$/, "") + "/plug?" + params.toString();
  }

  // Inject the modal CSS once: dim backdrop + a centered dialog on desktop,
  // a slide-up bottom sheet on phones — the same shape as the Privy modal.
  var STYLE_ID = "swish-plug-styles";
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".swish-plug-bd{position:fixed;inset:0;z-index:2147483647;background:rgba(18,18,18,.6);" +
      "display:flex;align-items:center;justify-content:center;padding:16px;animation:swishPlugFade .15s ease}" +
      ".swish-plug-fr{width:100%;max-width:400px;height:520px;max-height:90vh;border:0;border-radius:24px;" +
      "background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
      "@keyframes swishPlugFade{from{opacity:0}to{opacity:1}}" +
      "@keyframes swishPlugUp{from{transform:translateY(100%)}to{transform:translateY(0)}}" +
      "@media (max-width:640px){.swish-plug-bd{align-items:flex-end;padding:0}" +
      ".swish-plug-fr{max-width:none;border-radius:20px 20px 0 0;" +
      "box-shadow:0 -8px 40px rgba(0,0,0,.35);animation:swishPlugUp .25s ease}}";
    document.head.appendChild(s);
  }

  function open(opts) {
    opts = opts || {};
    var baseUrl = opts.baseUrl || DEFAULT_BASE;
    var iframeOrigin = baseUrl.replace(/\/$/, "");
    ensureStyles();

    // Backdrop dims the host page; the iframe is the centered dialog / bottom
    // sheet, sized to the height the hosted widget reports.
    var backdrop = document.createElement("div");
    backdrop.className = "swish-plug-bd";

    var iframe = document.createElement("iframe");
    iframe.className = "swish-plug-fr";
    iframe.src = buildSrc(baseUrl, opts);
    iframe.allow = "clipboard-write; payment";
    backdrop.appendChild(iframe);

    var closed = false;
    function cleanup() {
      if (closed) return;
      closed = true;
      window.removeEventListener("message", onMessage);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    function onMessage(e) {
      // Only trust messages from the hosted widget origin.
      if (e.origin !== iframeOrigin) return;
      var data = e.data;
      if (!data || typeof data.type !== "string") return;

      switch (data.type) {
        case MSG.READY:
          // Config already travels in the URL; this is a hook for future
          // dynamic updates. Re-send via postMessage so either path works.
          iframe.contentWindow.postMessage(
            { type: MSG.CONFIG, config: stripCallbacks(opts) },
            iframeOrigin
          );
          break;
        case MSG.RESIZE:
          // Size the dialog to the card's content height.
          if (typeof data.height === "number" && data.height > 0) {
            iframe.style.height = data.height + "px";
          }
          break;
        case MSG.SUCCESS:
          if (typeof opts.onSuccess === "function") {
            opts.onSuccess(data.txSignature, data.reference);
          }
          cleanup();
          break;
        case MSG.ERROR:
          if (typeof opts.onError === "function") opts.onError(data.message);
          break;
        case MSG.CLOSE:
          if (typeof opts.onClose === "function") opts.onClose();
          cleanup();
          break;
      }
    }

    // Click outside the dialog closes it (a dismiss).
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) {
        if (typeof opts.onClose === "function") opts.onClose();
        cleanup();
      }
    });

    window.addEventListener("message", onMessage);
    document.body.appendChild(backdrop);

    return { close: cleanup };
  }

  // Don't forward functions (or baseUrl) into the iframe via postMessage.
  function stripCallbacks(opts) {
    return {
      recipient: opts.recipient,
      amount: opts.amount,
      token: opts.token,
      reference: opts.reference,
      returnUrl: opts.returnUrl,
    };
  }

  var SWISH_MARK =
    '<svg width="29" height="15" viewBox="0 0 289 148" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M24.0052 24.0052L60.2824 96.5595C62.1139 100.223 66.9958 101.015 69.8916 98.1189L98.6645 69.346C101.395 66.6152 105.957 67.138 107.999 70.4157L139.349 120.73C141.713 124.524 147.247 124.493 149.569 120.673L180.038 70.5344C182.057 67.2105 186.657 66.6574 189.408 69.4077L218.119 98.1189C221.015 101.015 225.897 100.223 227.728 96.5595L264.005 24.0052" stroke="currentColor" stroke-width="48" stroke-miterlimit="3.99393" stroke-linecap="round"/></svg>';

  // Build the branded "Deposit Privately" trigger button. Auto-shrinks to
  // "Deposit" when the button is narrower than ~150px.
  function createButton(opts) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "gap:8px",
      "background:#121212",
      "color:#fff",
      "border:0",
      "border-radius:999px",
      "padding:12px 22px",
      "font-size:15px",
      "font-weight:500",
      "font-family:inherit",
      "cursor:pointer",
      "white-space:nowrap",
    ].join(";");

    var labelEl = document.createElement("span");
    function render() {
      var compact = opts.compact != null ? opts.compact : btn.clientWidth && btn.clientWidth < 150;
      labelEl.textContent =
        opts.label || (compact ? "Deposit" : "Deposit Privately");
    }
    btn.innerHTML = SWISH_MARK;
    btn.appendChild(labelEl);
    render();

    btn.addEventListener("click", function () {
      open(opts);
    });
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(render).observe(btn);
    }
    return btn;
  }

  // Inject a branded button into `target` (an element or a CSS selector).
  function mount(target, opts) {
    var el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!el) throw new Error("Plug.mount: target not found");
    var btn = createButton(opts || {});
    el.appendChild(btn);
    return btn;
  }

  // Auto-bind any <div data-swish-plug data-recipient=… data-amount=…>.
  function autoInit() {
    var nodes = document.querySelectorAll("[data-swish-plug]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute("data-swish-plug-mounted")) continue;
      el.setAttribute("data-swish-plug-mounted", "1");
      var amt = el.getAttribute("data-amount");
      mount(el, {
        recipient: el.getAttribute("data-recipient") || undefined,
        amount: amt != null ? Number(amt) : undefined,
        reference: el.getAttribute("data-reference") || undefined,
        label: el.getAttribute("data-label") || undefined,
        baseUrl: el.getAttribute("data-base-url") || undefined,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }

  window.Plug = { open: open, mount: mount, button: createButton };
})();
