import { Suspense } from "react";
import { PlugWidget } from "./PlugWidget";

// The Plug — Swish's embeddable private-payments widget, hosted at
// swish.cash/plug. Rendered bare (root layout only, no app chrome) so it
// drops cleanly into an integrator's iframe or a hosted-checkout redirect.
//
// Config arrives via URL params (?recipient=&amount=&token=&reference=&returnUrl=)
// — the race-free primary path — and may also be pushed via postMessage.

export const dynamic = "force-dynamic";

export default function PlugPage() {
  return (
    <Suspense fallback={null}>
      <PlugWidget />
    </Suspense>
  );
}
