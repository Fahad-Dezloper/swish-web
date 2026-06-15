import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// Force dynamic rendering for all pages - required for Privy auth
export const dynamic = "force-dynamic";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jost",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://swish.privacy.cash"),
  title: "Swish",
  description: "Privacy, made simple",
  icons: {
    icon: "/assets/logo.svg",
  },
  openGraph: {
    title: "Swish",
    description: "Privacy, made simple",
    images: ["/assets/open-graph-main.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Swish",
    description: "Privacy, made simple",
    images: ["/assets/open-graph-main.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jost.className} antialiased bg-[#121212] min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
