import { NextRequest, NextResponse } from "next/server";

/**
 * Host-based routing for the Plug's isolated origin.
 *
 * The Plug iframe + playground are served from `plug.swish.cash` — a SEPARATE
 * origin from the main app (`swish.cash`). Separate origin = its own session
 * jar, so a logged-in swish.cash user is NOT inherited into the widget (the
 * root fix that replaces the `hasConnected` band-aid in PlugWidget).
 *
 * - On `plug.swish.cash`: only the playground (`/`) and the iframe (`/plug`)
 *   exist; everything else bounces to the playground so the subdomain never
 *   exposes the full app.
 * - On `swish.cash` (main): the Plug surfaces are pushed onto the subdomain —
 *   `/playground` and `/plug` redirect to `plug.swish.cash`, so even a stale
 *   embed hardcoded to `swish.cash/plug` lands on the isolated origin.
 *
 * Local testing needs no DNS: browsers auto-resolve `*.localhost`, so
 * `plug.localhost:3000` hits the playground and `localhost:3000` hits the app.
 */

function hostname(host: string): string {
  return host.split(":")[0].toLowerCase();
}

function isPlugHost(host: string): boolean {
  return hostname(host).startsWith("plug.");
}

// `localhost` / 127.0.0.1 are Privy-trusted secure contexts; `plug.localhost`
// is NOT (Privy gates the embedded wallet on exact-`localhost` over HTTP). So
// locally we DON'T bounce main-host `/plug` onto `plug.localhost` — that would
// break Privy. Plain `localhost:3000/plug` stays directly testable; the
// main→subdomain redirect is a prod-only hardening.
function isLocalHost(host: string): boolean {
  const h = hostname(host);
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1";
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname, search } = req.nextUrl;
  const proto = req.headers.get("x-forwarded-proto") || "https";

  // Build a same-host URL from the Host HEADER, not req.nextUrl (whose host is
  // the connection address — e.g. `localhost`, dropping the `plug.` subdomain).
  const onThisHost = (path: string) => `${proto}://${host}${path}`;

  if (isPlugHost(host)) {
    // The playground lives at /playground. Redirect (not rewrite) `/` to it so
    // the path-based CSP rule in next.config applies cleanly — a rewrite would
    // keep the request path as `/` and pick up the strict, no-embed policy.
    if (pathname === "/") {
      return NextResponse.redirect(onThisHost("/playground"));
    }
    if (
      pathname === "/playground" ||
      pathname === "/plug" ||
      pathname.startsWith("/plug/") ||
      pathname === "/plug.js"
    ) {
      return NextResponse.next();
    }
    // Anything else on the subdomain → back to the playground.
    return NextResponse.redirect(onThisHost("/playground"));
  }

  // Main host: force the Plug surfaces onto the isolated origin (prod only —
  // see isLocalHost: locally `localhost:3000/plug` must stay directly usable).
  if (!isLocalHost(host)) {
    if (pathname === "/playground") {
      return NextResponse.redirect(`${proto}://plug.${host}/playground`);
    }
    if (pathname === "/plug" || pathname.startsWith("/plug/")) {
      return NextResponse.redirect(`${proto}://plug.${host}${pathname}${search}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run everywhere except API routes, Next internals, and static assets — but
  // KEEP `/plug.js` in scope so the subdomain can serve the loader.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets/).*)"],
};
