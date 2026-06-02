"use client";

import { useEffect, useState } from "react";

/**
 * Returns a value that lingers for `delayMs` after the source becomes null,
 * so a child component can animate-out before being unmounted.
 *
 * Usage:
 *   const [active, setActive] = useState<Modal | null>(null);
 *   const mounted = useDelayedUnmount(active, 350);
 *   // pass isOpen={active === "send"} so the child sees the flip first
 *   {mounted === "send" && <SendModal isOpen={active === "send"} ... />}
 */
export function useDelayedUnmount<T>(value: T | null, delayMs: number): T | null {
  const [mounted, setMounted] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setMounted(value);
      return;
    }
    const t = setTimeout(() => setMounted(null), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return mounted;
}
