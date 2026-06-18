import Providers from "../providers";

// The Plug iframe renders bare (no app chrome) but DOES need Privy for wallet
// connect/sign — so it mounts its own <Providers> here, independent of the
// (app) group. Kept separate from the root layout so the sibling /playground
// route can render without Privy.
export default function PlugLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Providers>{children}</Providers>;
}
