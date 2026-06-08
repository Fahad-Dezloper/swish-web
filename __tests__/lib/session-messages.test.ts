import { describe, it, expect } from "vitest";
import {
  PC_SESSION_MESSAGE,
  MB_SESSION_MESSAGE,
  UMBRA_SESSION_MESSAGE,
  REQUEST_SESSION_MESSAGE,
  getSessionMessageForProvider,
} from "@/lib/session-messages";

describe("session message constants", () => {
  it("PC message is the SDK-locked string (cannot change without breaking PC encryption)", () => {
    expect(PC_SESSION_MESSAGE).toBe("Privacy Money account sign in");
  });

  it("MB message is Swish-branded", () => {
    expect(MB_SESSION_MESSAGE).toBe("Magic Block Swish sign in");
  });

  it("Umbra message is Swish-branded", () => {
    expect(UMBRA_SESSION_MESSAGE).toBe("Umbra Privacy Swish sign in");
  });

  it("Request message is Swish-scoped (no protocol)", () => {
    expect(REQUEST_SESSION_MESSAGE).toBe("Swish Request signature");
  });

  it("all four messages are distinct strings", () => {
    const messages = [
      PC_SESSION_MESSAGE,
      MB_SESSION_MESSAGE,
      UMBRA_SESSION_MESSAGE,
      REQUEST_SESSION_MESSAGE,
    ];
    const unique = new Set(messages);
    expect(unique.size).toBe(4);
  });
});

describe("getSessionMessageForProvider", () => {
  it("returns PC message for privacy-cash", () => {
    expect(getSessionMessageForProvider("privacy-cash")).toBe(PC_SESSION_MESSAGE);
  });

  it("returns MB message for magicblock-per", () => {
    expect(getSessionMessageForProvider("magicblock-per")).toBe(MB_SESSION_MESSAGE);
  });

  it("returns Umbra message for umbra", () => {
    expect(getSessionMessageForProvider("umbra")).toBe(UMBRA_SESSION_MESSAGE);
  });

  it("covers all ProviderId values (no uncovered branch)", () => {
    const providers = ["privacy-cash", "magicblock-per", "umbra"] as const;
    for (const p of providers) {
      expect(() => getSessionMessageForProvider(p)).not.toThrow();
      expect(typeof getSessionMessageForProvider(p)).toBe("string");
    }
  });
});
