import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isProviderId, DEFAULT_PROVIDER_ID } from "@/lib/providers/types";
import {
  getDisabledProviderIds,
  isProviderDisabled,
  areAllProvidersDisabled,
} from "@/lib/providers/maintenance";

describe("isProviderId", () => {
  it("accepts privacy-cash", () => {
    expect(isProviderId("privacy-cash")).toBe(true);
  });

  it("accepts magicblock-per", () => {
    expect(isProviderId("magicblock-per")).toBe(true);
  });

  it("accepts umbra", () => {
    expect(isProviderId("umbra")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isProviderId("")).toBe(false);
  });

  it("rejects unknown string", () => {
    expect(isProviderId("solana-pay")).toBe(false);
  });

  it("rejects partial match", () => {
    expect(isProviderId("privacy")).toBe(false);
    expect(isProviderId("umbra ")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isProviderId("Privacy-Cash")).toBe(false);
    expect(isProviderId("UMBRA")).toBe(false);
  });
});

describe("DEFAULT_PROVIDER_ID", () => {
  it("is privacy-cash", () => {
    expect(DEFAULT_PROVIDER_ID).toBe("privacy-cash");
  });

  it("is a valid ProviderId", () => {
    expect(isProviderId(DEFAULT_PROVIDER_ID)).toBe(true);
  });
});

describe("getDisabledProviderIds", () => {
  const originalEnv = process.env.DISABLED_PROVIDERS;

  afterEach(() => {
    process.env.DISABLED_PROVIDERS = originalEnv;
  });

  it("returns empty array when env is unset", () => {
    delete process.env.DISABLED_PROVIDERS;
    expect(getDisabledProviderIds()).toEqual([]);
  });

  it("returns empty array when env is empty string", () => {
    process.env.DISABLED_PROVIDERS = "";
    expect(getDisabledProviderIds()).toEqual([]);
  });

  it("returns empty array when env is only whitespace", () => {
    process.env.DISABLED_PROVIDERS = "   ";
    expect(getDisabledProviderIds()).toEqual([]);
  });

  it("parses a single provider id", () => {
    process.env.DISABLED_PROVIDERS = "umbra";
    expect(getDisabledProviderIds()).toEqual(["umbra"]);
  });

  it("parses multiple provider ids", () => {
    process.env.DISABLED_PROVIDERS = "umbra,magicblock-per";
    expect(getDisabledProviderIds()).toContain("umbra");
    expect(getDisabledProviderIds()).toContain("magicblock-per");
    expect(getDisabledProviderIds()).toHaveLength(2);
  });

  it("trims whitespace around ids", () => {
    process.env.DISABLED_PROVIDERS = " umbra , magicblock-per ";
    expect(getDisabledProviderIds()).toContain("umbra");
    expect(getDisabledProviderIds()).toContain("magicblock-per");
  });

  it("silently drops unknown ids", () => {
    process.env.DISABLED_PROVIDERS = "umbra,unknown-protocol,magicblock-per";
    const result = getDisabledProviderIds();
    expect(result).toContain("umbra");
    expect(result).toContain("magicblock-per");
    expect(result).not.toContain("unknown-protocol");
    expect(result).toHaveLength(2);
  });
});

describe("isProviderDisabled", () => {
  const originalEnv = process.env.DISABLED_PROVIDERS;

  afterEach(() => {
    process.env.DISABLED_PROVIDERS = originalEnv;
  });

  it("returns true when provider is disabled", () => {
    process.env.DISABLED_PROVIDERS = "umbra";
    expect(isProviderDisabled("umbra")).toBe(true);
  });

  it("returns false when provider is not in the list", () => {
    process.env.DISABLED_PROVIDERS = "umbra";
    expect(isProviderDisabled("privacy-cash")).toBe(false);
  });

  it("returns false when list is empty", () => {
    process.env.DISABLED_PROVIDERS = "";
    expect(isProviderDisabled("privacy-cash")).toBe(false);
  });
});

describe("areAllProvidersDisabled", () => {
  const originalEnv = process.env.DISABLED_PROVIDERS;

  afterEach(() => {
    process.env.DISABLED_PROVIDERS = originalEnv;
  });

  it("returns true when all given ids are disabled", () => {
    process.env.DISABLED_PROVIDERS = "umbra,magicblock-per,privacy-cash";
    expect(
      areAllProvidersDisabled(["umbra", "magicblock-per", "privacy-cash"])
    ).toBe(true);
  });

  it("returns false when only some ids are disabled", () => {
    process.env.DISABLED_PROVIDERS = "umbra";
    expect(areAllProvidersDisabled(["umbra", "privacy-cash"])).toBe(false);
  });

  it("returns false when no ids are disabled", () => {
    process.env.DISABLED_PROVIDERS = "";
    expect(areAllProvidersDisabled(["umbra", "privacy-cash"])).toBe(false);
  });

  it("returns false for an empty array (no providers to disable)", () => {
    process.env.DISABLED_PROVIDERS = "umbra,magicblock-per,privacy-cash";
    expect(areAllProvidersDisabled([])).toBe(false);
  });
});
