import type { NextConfig } from "next";

// Derive the configured RPC + Supabase origins from env so the CSP allows the
// exact hosts the browser talks to (origin only — no path/api-key).
function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}
const rpcHttp = originOf(process.env.NEXT_PUBLIC_RPC_URL);
const rpcWss = rpcHttp ? rpcHttp.replace(/^https/, "wss") : "";
const supabaseHttp = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseWss = supabaseHttp ? supabaseHttp.replace(/^https/, "wss") : "";

// Everything the browser connects to (fetch / WebSocket / RPC).
const connectSrc = [
  "'self'",
  // Privy
  "https://auth.privy.io",
  "https://*.rpc.privy.systems",
  // WalletConnect / wallet-standard
  "https://explorer-api.walletconnect.com",
  "https://*.walletconnect.com",
  "wss://relay.walletconnect.com",
  "wss://relay.walletconnect.org",
  "wss://www.walletlink.org",
  // Solana RPC (configured Helius + public fallback, http + ws)
  rpcHttp,
  rpcWss,
  "https://*.helius-rpc.com",
  "wss://*.helius-rpc.com",
  "https://api.mainnet-beta.solana.com",
  "wss://api.mainnet-beta.solana.com",
  // Supabase
  supabaseHttp,
  supabaseWss,
  "https://*.supabase.co",
  "wss://*.supabase.co",
  // Protocols / price
  "https://*.umbraprivacy.com",
  "https://payments.magicblock.app",
  "https://hermes.pyth.network",
]
  .filter(Boolean)
  .join(" ");

// NOTE: script-src includes 'unsafe-inline'/'unsafe-eval'/'wasm-unsafe-eval' —
// required for Next.js inline hydration scripts (no nonce, since we use static
// headers not middleware) and the app's WASM (privacycash / hasher.rs, Solana
// crypto). Tighten to a nonce-based policy later via middleware if desired.
//
// `frameAncestors` is parameterized so the embeddable /plug route can relax it
// (the rest of the app stays 'none'). For v1 the Plug allows any ancestor —
// it's non-custodial (payer signs its own tx), so framing it carries no fund
// risk. Tighten to a per-integrator allowlist when the Plug graduates from
// validation.
const buildCsp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://auth.privy.io https://explorer-api.walletconnect.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    "child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
    "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");

const csp = buildCsp("'none'");
const plugCsp = buildCsp("*");

// Security headers shared by every route. Framing control (CSP frame-ancestors
// + X-Frame-Options) is layered on per-rule so /plug can opt out.
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["privacycash", "@lightprotocol/hasher.rs"],
  async headers() {
    return [
      {
        // Everything EXCEPT the embeddable Plug route/asset gets the strict,
        // unframeable policy. The negative lookahead excludes /plug and
        // /plug.js so their dedicated rule below wins without duplicate headers.
        source: "/((?!plug).*)",
        headers: [
          // CSP enforced — Report-Only run was clean (no violations in prod).
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          ...baseSecurityHeaders,
        ],
      },
      {
        // The Plug is meant to be embedded: relax frame-ancestors, drop
        // X-Frame-Options entirely (it can't express an allowlist), keep the
        // rest of the hardening.
        source: "/plug",
        headers: [
          { key: "Content-Security-Policy", value: plugCsp },
          ...baseSecurityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
