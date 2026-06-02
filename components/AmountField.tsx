"use client";

import Image from "next/image";

interface AmountFieldProps {
  /** Current amount as a string (driven by the keypad). */
  amount: string;
  /** Asset symbol shown next to the amount + inside the chip. */
  assetSymbol?: string;
  /** When provided, renders a MAX button that fills the full balance. */
  onMax?: () => void;
  /** When provided, the asset chip becomes tappable (asset picker). */
  onAssetClick?: () => void;
}

/**
 * Pill-style amount display: [asset chip ▾] [amount SYMBOL] [MAX].
 * The amount itself is edited via the NumberPad below it — this is the
 * read-only display, with MAX as a fill-balance shortcut.
 */
export function AmountField({
  amount,
  assetSymbol = "USDC",
  onMax,
  onAssetClick,
}: AmountFieldProps) {
  return (
    <div className="flex items-center gap-3 bg-[#121212]/[0.04] rounded-full p-2 h-16">
      {/* Asset chip */}
      <button
        type="button"
        onClick={onAssetClick}
        disabled={!onAssetClick}
        className="flex items-center gap-1 bg-[#fafafa] rounded-full pl-1.5 pr-2 py-1.5 shrink-0 shadow-[0_1px_3px_rgba(18,18,18,0.08)] disabled:cursor-default"
      >
        <Image
          src="/assets/usdc-icon.svg"
          alt={assetSymbol}
          width={26}
          height={26}
        />
        <Image
          src="/assets/chevron-down-icon.svg"
          alt=""
          width={12}
          height={12}
        />
      </button>

      {/* Amount + symbol */}
      <div className="flex-1 flex items-baseline gap-1.5 min-w-0 overflow-x-auto scrollbar-hide">
        <span className="text-2xl font-medium text-[#121212] whitespace-nowrap">
          {amount}
        </span>
        <span className="text-2xl font-medium text-[#121212]/30 whitespace-nowrap">
          {assetSymbol}
        </span>
      </div>

      {/* MAX */}
      {onMax && (
        <button
          type="button"
          onClick={onMax}
          className="shrink-0 bg-[#121212] text-[#fafafa] rounded-full px-4 h-10 text-sm font-bold active:scale-95 transition-transform"
        >
          MAX
        </button>
      )}
    </div>
  );
}
