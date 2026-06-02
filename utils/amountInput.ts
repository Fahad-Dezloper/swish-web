// Per-asset decimal precision. USDC = 6, SOL = 9. Only USDC is live today;
// add assets here as they ship and the keypad/input will respect them.
export const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  SOL: 9,
};

export function decimalsForAsset(symbol: string): number {
  return ASSET_DECIMALS[symbol] ?? 6;
}

/**
 * Apply one keypad press (`0`–`9` or `.`) to the current amount string,
 * capping the fractional part to `maxDecimals`. Returns the new amount
 * (unchanged if the press isn't allowed — e.g. a 2nd "." or a digit past the
 * decimal limit). Backspace is handled separately by the caller.
 */
export function appendAmountKey(
  current: string,
  key: string,
  maxDecimals: number
): string {
  if (key === ".") {
    // Only one decimal point; no extra "." once the limit is 0.
    if (maxDecimals <= 0 || current.includes(".")) return current;
    return current + ".";
  }

  // First significant digit replaces a lone leading "0".
  if (current === "0") return key;

  // Block typing past the asset's decimal precision.
  const dotIndex = current.indexOf(".");
  if (dotIndex !== -1) {
    const decimalsTyped = current.length - dotIndex - 1;
    if (decimalsTyped >= maxDecimals) return current;
  }

  return current + key;
}
