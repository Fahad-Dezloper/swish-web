"use client";

import Image from "next/image";

/**
 * One asset line: icon · symbol / native amount · ~USD. Shared by the
 * AccountChip dropdown and the Profile wallet tab so they stay identical.
 * `native` and `usd` are pre-formatted strings (so callers handle loading).
 */
export function AssetRow({
  icon,
  symbol,
  native,
  usd,
  className = "",
}: {
  icon: string;
  symbol: string;
  native: string;
  usd: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image src={icon} alt={symbol} width={28} height={28} />
      <div className="flex-1 min-w-0 text-left leading-tight">
        <div className="text-[#121212] text-sm font-medium">{symbol}</div>
        <div className="text-[#121212]/40 text-xs mt-0.5">{native}</div>
      </div>
      <div className="text-[#121212] text-sm font-medium">{usd}</div>
    </div>
  );
}
