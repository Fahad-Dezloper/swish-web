"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface NumberPadProps {
  onNumberPress: (num: string) => void;
  onBackspace: () => void;
}

export function NumberPad({ onNumberPress, onBackspace }: NumberPadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];
  // Which key to briefly highlight (set when a physical key is pressed).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest handlers, so the keydown listener attaches once but always calls
  // the current callbacks.
  const handlers = useRef({ onNumberPress, onBackspace });
  useEffect(() => {
    handlers.current = { onNumberPress, onBackspace };
  });

  // Desktop physical-keyboard entry. NumberPad is only mounted during the
  // amount step (no text fields there), so this never hijacks typing in the
  // recipient/message inputs.
  useEffect(() => {
    const flash = (key: string) => {
      setActiveKey(key);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setActiveKey(null), 150);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        flash(e.key);
        handlers.current.onNumberPress(e.key);
      } else if (e.key === ".") {
        e.preventDefault();
        flash(".");
        handlers.current.onNumberPress(".");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        flash("backspace");
        handlers.current.onBackspace();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-y-2 gap-x-4 w-full">
      {keys.map((num) => (
        <button
          key={num}
          onClick={() => onNumberPress(num)}
          className={`h-14 text-2xl font-medium text-[#121212] rounded-xl outline-none transition-colors hover:bg-[#121212]/5 ${
            activeKey === num ? "bg-[#121212]/10" : "active:bg-[#121212]/10"
          }`}
        >
          {num}
        </button>
      ))}
      <button
        onClick={onBackspace}
        className={`h-14 flex items-center justify-center rounded-xl outline-none transition-colors hover:bg-[#121212]/5 ${
          activeKey === "backspace" ? "bg-[#121212]/10" : "active:bg-[#121212]/10"
        }`}
      >
        <Image src="/assets/delete.svg" alt="Delete" width={28} height={19} />
      </button>
    </div>
  );
}
