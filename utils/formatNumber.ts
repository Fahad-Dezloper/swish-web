/**
 * Formats a number for display.
 * - Below 1000: truncates to 3 decimals (no rounding either way) so a
 *   balance is shown as-is and never rounded up to something the user
 *   doesn't actually hold. Trailing zeros stripped.
 * - 1000+: abbreviated with K/M/B and up to 2 decimals (truncated).
 * - Removes trailing zero in decimal (e.g., 1.50 -> 1.5)
 * - Removes decimal entirely if .0 (e.g., 1.0 -> 1)
 *
 * Examples:
 * - 0.114567 -> "0.114"
 * - 1.5 -> "1.5"
 * - 999 -> "999"
 * - 1000 -> "1K"
 * - 1234 -> "1.23K"
 * - 1500 -> "1.5K"
 * - 1000000 -> "1M"
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
      // Truncate to 2 decimal places (never overstate the amount)
      const rounded = Math.floor(scaled * 100) / 100;
      // Format with up to 2 decimals, remove trailing zeros
      const formatted = rounded.toFixed(2).replace(/\.?0+$/, "");
      return `${formatted}${suffix}`;
    }
  }

  // For numbers less than 1000
  if (Number.isInteger(num)) {
    return num.toString();
  }

  // Truncate to 3 decimals, no rounding. toFixed(6) is exact for USDC
  // (<=6 decimals), and slicing off digits 4-6 drops them without
  // rounding the 3rd — avoiding float error from `Math.floor(num*1000)`.
  const [intPart, decPart] = num.toFixed(6).split(".");
  return `${intPart}.${decPart.slice(0, 3)}`.replace(/\.?0+$/, "");
}

/**
 * Formats a currency amount (USDC) with proper formatting
 */
export function formatUSDC(amount: number): string {
  return `${formatNumber(amount)} USDC`;
}
