const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[Number(d)])
    .join("");
}

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

  if (num < 0.001) {
    const decimals = num.toFixed(12).split(".")[1];
    const leadingZeros = decimals.search(/[1-9]/);
    if (leadingZeros === -1) return "0";
    const sig = decimals.slice(leadingZeros).replace(/0+$/, "").slice(0, 3);
    return `0.0${toSubscript(leadingZeros)}${sig}`;
  }

  const [intPart, decPart] = num.toFixed(6).split(".");
  return `${intPart}.${decPart.slice(0, 3)}`.replace(/\.?0+$/, "");
}

export function formatUSDC(amount: number): string {
  return `${formatNumber(amount)} USDC`;
}
