"use client";

import { useEffect, useState } from "react";

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
