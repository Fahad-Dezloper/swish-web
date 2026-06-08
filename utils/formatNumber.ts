const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

// Render a count as subscript digits, e.g. 3 -> "₃", 12 -> "₁₂".
function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[Number(d)])
    .join("");
}

/**
 * Formats a number for display.
 * - Below 0.001 (but > 0): subscript zero-count notation so a real balance
 *   isn't hidden as "0". A small digit counts the leading zeros, then up to
 *   3 significant digits (truncated). e.g. 0.0004 -> "0.0₃4".
 * - 0.001 to <1000: truncates to 3 decimals (no rounding either way) so a
 *   balance is shown as-is and never rounded up to something the user
 *   doesn't actually hold. Trailing zeros stripped.
 * - 1000+: abbreviated with K/M/B and up to 2 decimals (truncated).
 * - Removes trailing zero in decimal (e.g., 1.50 -> 1.5)
 * - Removes decimal entirely if .0 (e.g., 1.0 -> 1)
 *
 * Examples:
 * - 0.0004 -> "0.0₃4"
 * - 0.000045 -> "0.0₄45"
 * - 0.114567 -> "0.114"
 * - 1.5 -> "1.5"
 * - 999 -> "999"
 * - 1000 -> "1K"
 * - 1234 -> "1.23K"
 * - 1500000000 -> "1.5B"
 */
export function formatNumber(num: number): string {
  if (num < 0) {
    return `-${formatNumber(Math.abs(num))}`;
  }

  const suffixes = [
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" },
  ];

  for (const { value, suffix } of suffixes) {
    if (num >= value) {
      const scaled = num / value;
      const rounded = Math.floor(scaled * 100) / 100;
      const formatted = rounded.toFixed(2).replace(/\.?0+$/, "");
      return `${formatted}${suffix}`;
    }
  }

  if (Number.isInteger(num)) {
    return num.toString();
  }

  // Below 0.001 the 3-decimal truncation would collapse to "0" and hide a
  // real balance. Use subscript zero-count notation: a small digit counts
  // the leading zeros, then up to 3 significant digits (truncated, no
  // rounding). The leading "0" after "0." is decorative — the subscript is
  // the source of truth for the zero count. e.g. 0.000045 -> "0.0₄45".
  if (num < 0.001) {
    const decimals = num.toFixed(12).split(".")[1];
    const leadingZeros = decimals.search(/[1-9]/);
    // -1 = no significant digit within precision; treat as 0.
    if (leadingZeros === -1) return "0";
    const sig = decimals.slice(leadingZeros).replace(/0+$/, "").slice(0, 3);
    return `0.0${toSubscript(leadingZeros)}${sig}`;
  }

  // Truncate to 3 decimals, no rounding. toFixed(6) is exact for USDC
  // (<=6 decimals), and slicing off digits 4-6 drops them without
  // rounding the 3rd — avoiding float error from `Math.floor(num*1000)`.
  const [intPart, decPart] = num.toFixed(6).split(".");
  return `${intPart}.${decPart.slice(0, 3)}`.replace(/\.?0+$/, "");
}

export function formatUSDC(amount: number): string {
  return `${formatNumber(amount)} USDC`;
}
