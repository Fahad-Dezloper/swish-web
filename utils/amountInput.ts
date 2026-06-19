export const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  SOL: 9,
};

export function decimalsForAsset(symbol: string): number {
  return ASSET_DECIMALS[symbol] ?? 6;
}

export function appendAmountKey(
  current: string,
  key: string,
  maxDecimals: number
): string {
  if (key === ".") {
    if (maxDecimals <= 0 || current.includes(".")) return current;
    return current + ".";
  }

  if (current === "0") return key;

  const dotIndex = current.indexOf(".");
  if (dotIndex !== -1) {
    const decimalsTyped = current.length - dotIndex - 1;
    if (decimalsTyped >= maxDecimals) return current;
  }

  return current + key;
}
