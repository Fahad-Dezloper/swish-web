import { Logo, Footer, MaintenanceBanner } from "@/components";
import Providers from "../providers";

// The main Swish app chrome (centered card, header, footer). Lives in the
// (app) route group so sibling routes like /plug can render bare — without
// the app shell — for embedding. Privy <Providers> is mounted HERE (not in the
// root layout) so the bare /playground route can opt out of Privy entirely —
// it has no embedded-wallet need and would otherwise hit Privy's HTTPS gate.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <div className="mx-auto w-full max-w-107.5 min-h-screen bg-[#fafafa] relative">
        <div className="min-h-screen flex flex-col">
          <MaintenanceBanner />
          {/* Header with Logo */}
          <header className="flex justify-center pt-8 pb-4">
            <Logo />
          </header>

          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center">
            {children}
          </div>

          {/* Footer Navigation */}
          <Footer />
        </div>
      </div>
    </Providers>
  );
}
