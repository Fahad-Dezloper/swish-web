import { Logo, Footer, MaintenanceBanner } from "@/components";

// The main Swish app chrome (centered card, header, footer). Lives in the
// (app) route group so sibling routes like /plug can render bare — without
// the app shell — for embedding.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto w-full max-w-107.5 min-h-screen bg-[#fafafa] relative">
      <div className="min-h-screen flex flex-col">
        <MaintenanceBanner />
        {/* Header with Logo */}
        <header className="flex justify-center pt-8 pb-4">
          <Logo />
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center">{children}</div>

        {/* Footer Navigation */}
        <Footer />
      </div>
    </div>
  );
}
