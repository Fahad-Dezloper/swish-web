import { describe, it, expect } from "vitest";
import {
  estimatePcFee,
  estimateMbFee,
  estimateUmbraFee,
  estimateFee,
} from "@/lib/fees";

describe("estimatePcFee", () => {
  it("adds base fee plus 0.35% bps", () => {
    const { feeUSDC } = estimatePcFee(100, 0.71);
    expect(feeUSDC).toBeCloseTo(0.71 + 0.35, 4);
  });

  it("bps scales with amount", () => {
    const { feeUSDC: fee1 } = estimatePcFee(1000, 0.71);
    const { feeUSDC: fee2 } = estimatePcFee(2000, 0.71);
    expect(fee2 - fee1).toBeCloseTo(3.5, 4);
  });

  it("returns breakdown string mentioning base", () => {
    const { breakdown } = estimatePcFee(100, 0.71);
    expect(breakdown).toContain("0.71");
    expect(breakdown).toContain("0.35%");
  });

  it("works with zero base fee", () => {
    const { feeUSDC } = estimatePcFee(100, 0);
    expect(feeUSDC).toBeCloseTo(0.35, 4);
  });

  it("works with zero amount", () => {
    const { feeUSDC } = estimatePcFee(0, 0.71);
    expect(feeUSDC).toBeCloseTo(0.71, 4);
  });
});

describe("estimateMbFee", () => {
  it("is approximately 0.1% of amount", () => {
    const { feeUSDC } = estimateMbFee(100);
    // amount - amount/1.001 ≈ amount * 0.001/1.001 ≈ 0.0999%
    expect(feeUSDC).toBeCloseTo(100 - 100 / 1.001, 6);
  });

  it("scales linearly with amount", () => {
    const { feeUSDC: fee100 } = estimateMbFee(100);
    const { feeUSDC: fee200 } = estimateMbFee(200);
    expect(fee200).toBeCloseTo(fee100 * 2, 6);
  });

  it("breakdown is 0.1%", () => {
    expect(estimateMbFee(100).breakdown).toBe("0.1%");
  });

  it("works with zero amount", () => {
    expect(estimateMbFee(0).feeUSDC).toBe(0);
  });
});

describe("estimateUmbraFee", () => {
  it("send flow: 0.7% fee", () => {
    expect(estimateUmbraFee(100, "send").feeUSDC).toBeCloseTo(0.7, 4);
  });

  it("fulfill flow: 0.7% fee", () => {
    expect(estimateUmbraFee(200, "fulfill").feeUSDC).toBeCloseTo(1.4, 4);
  });

  it("send_claim flow: 0.75% fee (SUV)", () => {
    expect(estimateUmbraFee(100, "send_claim").feeUSDC).toBeCloseTo(0.75, 4);
  });

  it("send_claim breakdown is empty (no breakdown exposed to users per SUV model)", () => {
    expect(estimateUmbraFee(100, "send_claim").breakdown).toBe("");
  });

  it("send breakdown mentions 0.7%", () => {
    expect(estimateUmbraFee(100, "send").breakdown).toContain("0.7%");
  });
});

describe("estimateFee", () => {
  it("privacy-cash dispatches to estimatePcFee", () => {
    const { feeUSDC } = estimateFee("privacy-cash", 100, "send", 0.71);
    expect(feeUSDC).toBeCloseTo(estimatePcFee(100, 0.71).feeUSDC, 6);
  });

  it("magicblock-per dispatches to estimateMbFee", () => {
    const { feeUSDC } = estimateFee("magicblock-per", 100, "send", 0);
    expect(feeUSDC).toBeCloseTo(estimateMbFee(100).feeUSDC, 6);
  });

  it("auto dispatches to estimateMbFee", () => {
    const { feeUSDC } = estimateFee("auto", 100, "send", 0);
    expect(feeUSDC).toBeCloseTo(estimateMbFee(100).feeUSDC, 6);
  });

  it("umbra send dispatches to estimateUmbraFee send", () => {
    const { feeUSDC } = estimateFee("umbra", 100, "send", 0);
    expect(feeUSDC).toBeCloseTo(0.7, 4);
  });

  it("umbra send_claim dispatches to estimateUmbraFee send_claim", () => {
    const { feeUSDC } = estimateFee("umbra", 100, "send_claim", 0);
    expect(feeUSDC).toBeCloseTo(0.75, 4);
  });

  it("pc fee ignores flow parameter", () => {
    const feeA = estimateFee("privacy-cash", 100, "send", 0.71).feeUSDC;
    const feeB = estimateFee("privacy-cash", 100, "send_claim", 0.71).feeUSDC;
    expect(feeA).toBeCloseTo(feeB, 6);
  });
});
