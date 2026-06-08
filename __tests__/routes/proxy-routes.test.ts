/**
 * Integration tests: verify every app/api route handler forwards to the
 * correct swish-core path with the correct HTTP method.
 *
 * Strategy: mock global.fetch, call the route handler, assert the upstream
 * URL and method. No real network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── helper ────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setup() {
  fetchMock = vi.fn().mockResolvedValue({
    status: 200,
    json: () => Promise.resolve({ ok: true }),
  });
  global.fetch = fetchMock as any;
}

function calledPath(): string {
  const url: string = fetchMock.mock.calls[0][0];
  return new URL(url).pathname;
}

function calledMethod(): string {
  return fetchMock.mock.calls[0][1].method;
}

function makeGet(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

function makePost(path: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── tests ─────────────────────────────────────────────────────────────────

describe("GET /api/fee", () => {
  beforeEach(setup);
  it("proxies GET to /api/fee", async () => {
    const { GET } = await import("@/app/api/fee/route");
    await GET(makeGet("/api/fee"));
    expect(calledPath()).toBe("/api/fee");
    expect(calledMethod()).toBe("GET");
  });
});

describe("GET /api/activity/user", () => {
  beforeEach(setup);
  it("proxies GET to /api/activity/user", async () => {
    const { GET } = await import("@/app/api/activity/user/route");
    await GET(makeGet("/api/activity/user?address=abc"));
    expect(calledPath()).toBe("/api/activity/user");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/activity/cancel", () => {
  beforeEach(setup);
  it("proxies POST to /api/activity/cancel", async () => {
    const { POST } = await import("@/app/api/activity/cancel/route");
    await POST(makePost("/api/activity/cancel"));
    expect(calledPath()).toBe("/api/activity/cancel");
    expect(calledMethod()).toBe("POST");
  });
});

describe("GET /api/router/preview", () => {
  beforeEach(setup);
  it("proxies GET to /api/router/preview", async () => {
    const { GET } = await import("@/app/api/router/preview/route");
    await GET(makeGet("/api/router/preview?flow=send&sender=abc"));
    expect(calledPath()).toBe("/api/router/preview");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/send/prepare", () => {
  beforeEach(setup);
  it("proxies POST to /api/send/prepare", async () => {
    const { POST } = await import("@/app/api/send/prepare/route");
    await POST(makePost("/api/send/prepare"));
    expect(calledPath()).toBe("/api/send/prepare");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/send/submit", () => {
  beforeEach(setup);
  it("proxies POST to /api/send/submit", async () => {
    const { POST } = await import("@/app/api/send/submit/route");
    await POST(makePost("/api/send/submit"));
    expect(calledPath()).toBe("/api/send/submit");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/send_claim/prepare", () => {
  beforeEach(setup);
  it("proxies POST to /api/send_claim/prepare", async () => {
    const { POST } = await import("@/app/api/send_claim/prepare/route");
    await POST(makePost("/api/send_claim/prepare"));
    expect(calledPath()).toBe("/api/send_claim/prepare");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/send_claim/submit", () => {
  beforeEach(setup);
  it("proxies POST to /api/send_claim/submit", async () => {
    const { POST } = await import("@/app/api/send_claim/submit/route");
    await POST(makePost("/api/send_claim/submit"));
    expect(calledPath()).toBe("/api/send_claim/submit");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/send_claim/claim", () => {
  beforeEach(setup);
  it("proxies POST to /api/send_claim/claim", async () => {
    const { POST } = await import("@/app/api/send_claim/claim/route");
    await POST(makePost("/api/send_claim/claim"));
    expect(calledPath()).toBe("/api/send_claim/claim");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/send_claim/reclaim", () => {
  beforeEach(setup);
  it("proxies POST to /api/send_claim/reclaim", async () => {
    const { POST } = await import("@/app/api/send_claim/reclaim/route");
    await POST(makePost("/api/send_claim/reclaim"));
    expect(calledPath()).toBe("/api/send_claim/reclaim");
    expect(calledMethod()).toBe("POST");
  });
});

describe("GET /api/send_claim/[id]", () => {
  beforeEach(setup);
  it("proxies GET to /api/send_claim/:id", async () => {
    const { GET } = await import("@/app/api/send_claim/[id]/route");
    const params = Promise.resolve({ id: "test-activity-id" });
    await GET(makeGet("/api/send_claim/test-activity-id"), { params });
    expect(calledPath()).toBe("/api/send_claim/test-activity-id");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/request/create", () => {
  beforeEach(setup);
  it("proxies POST to /api/request/create", async () => {
    const { POST } = await import("@/app/api/request/create/route");
    await POST(makePost("/api/request/create"));
    expect(calledPath()).toBe("/api/request/create");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/request/cancel", () => {
  beforeEach(setup);
  it("proxies POST to /api/request/cancel", async () => {
    const { POST } = await import("@/app/api/request/cancel/route");
    await POST(makePost("/api/request/cancel"));
    expect(calledPath()).toBe("/api/request/cancel");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/request/fulfill/prepare", () => {
  beforeEach(setup);
  it("proxies POST to /api/request/fulfill/prepare", async () => {
    const { POST } = await import("@/app/api/request/fulfill/prepare/route");
    await POST(makePost("/api/request/fulfill/prepare"));
    expect(calledPath()).toBe("/api/request/fulfill/prepare");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/request/fulfill/submit", () => {
  beforeEach(setup);
  it("proxies POST to /api/request/fulfill/submit", async () => {
    const { POST } = await import("@/app/api/request/fulfill/submit/route");
    await POST(makePost("/api/request/fulfill/submit"));
    expect(calledPath()).toBe("/api/request/fulfill/submit");
    expect(calledMethod()).toBe("POST");
  });
});

describe("GET /api/request/[id]", () => {
  beforeEach(setup);
  it("proxies GET to /api/request/:id", async () => {
    const { GET } = await import("@/app/api/request/[id]/route");
    const params = Promise.resolve({ id: "req-123" });
    await GET(makeGet("/api/request/req-123"), { params });
    expect(calledPath()).toBe("/api/request/req-123");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/withdraw", () => {
  beforeEach(setup);
  it("proxies POST to /api/withdraw", async () => {
    const { POST } = await import("@/app/api/withdraw/route");
    await POST(makePost("/api/withdraw"));
    expect(calledPath()).toBe("/api/withdraw");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/withdraw/submit", () => {
  beforeEach(setup);
  it("proxies POST to /api/withdraw/submit", async () => {
    const { POST } = await import("@/app/api/withdraw/submit/route");
    await POST(makePost("/api/withdraw/submit"));
    expect(calledPath()).toBe("/api/withdraw/submit");
    expect(calledMethod()).toBe("POST");
  });
});

describe("GET /api/user/check-x", () => {
  beforeEach(setup);
  it("proxies GET to /api/user/check-x", async () => {
    const { GET } = await import("@/app/api/user/check-x/route");
    await GET(makeGet("/api/user/check-x?handle=swish"));
    expect(calledPath()).toBe("/api/user/check-x");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/user/register", () => {
  beforeEach(setup);
  it("proxies POST to /api/user/register", async () => {
    const { POST } = await import("@/app/api/user/register/route");
    await POST(makePost("/api/user/register"));
    expect(calledPath()).toBe("/api/user/register");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/user/resolve-x", () => {
  beforeEach(setup);
  it("proxies POST to /api/user/resolve-x", async () => {
    const { POST } = await import("@/app/api/user/resolve-x/route");
    await POST(makePost("/api/user/resolve-x"));
    expect(calledPath()).toBe("/api/user/resolve-x");
    expect(calledMethod()).toBe("POST");
  });
});

describe("GET /api/umbra/status", () => {
  beforeEach(setup);
  it("proxies GET to /api/umbra/status", async () => {
    const { GET } = await import("@/app/api/umbra/status/route");
    await GET(makeGet("/api/umbra/status?address=abc"));
    expect(calledPath()).toBe("/api/umbra/status");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/umbra/sc/prepare", () => {
  beforeEach(setup);
  it("proxies POST to /api/umbra/sc/prepare", async () => {
    const { POST } = await import("@/app/api/umbra/sc/prepare/route");
    await POST(makePost("/api/umbra/sc/prepare"));
    expect(calledPath()).toBe("/api/umbra/sc/prepare");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/umbra/sc/record", () => {
  beforeEach(setup);
  it("proxies POST to /api/umbra/sc/record", async () => {
    const { POST } = await import("@/app/api/umbra/sc/record/route");
    await POST(makePost("/api/umbra/sc/record"));
    expect(calledPath()).toBe("/api/umbra/sc/record");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/umbra/send/record", () => {
  beforeEach(setup);
  it("proxies POST to /api/umbra/send/record", async () => {
    const { POST } = await import("@/app/api/umbra/send/record/route");
    await POST(makePost("/api/umbra/send/record"));
    expect(calledPath()).toBe("/api/umbra/send/record");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/umbra/fulfill/record", () => {
  beforeEach(setup);
  it("proxies POST to /api/umbra/fulfill/record", async () => {
    const { POST } = await import("@/app/api/umbra/fulfill/record/route");
    await POST(makePost("/api/umbra/fulfill/record"));
    expect(calledPath()).toBe("/api/umbra/fulfill/record");
    expect(calledMethod()).toBe("POST");
  });
});

describe("GET /api/umbra/claimed-utxos", () => {
  beforeEach(setup);
  it("proxies GET to /api/umbra/claimed-utxos", async () => {
    const { GET } = await import("@/app/api/umbra/claimed-utxos/route");
    await GET(makeGet("/api/umbra/claimed-utxos?wallet=abc"));
    expect(calledPath()).toBe("/api/umbra/claimed-utxos");
    expect(calledMethod()).toBe("GET");
  });
});

describe("POST /api/umbra/claimed-utxos/mark", () => {
  beforeEach(setup);
  it("proxies POST to /api/umbra/claimed-utxos/mark", async () => {
    const { POST } = await import("@/app/api/umbra/claimed-utxos/mark/route");
    await POST(makePost("/api/umbra/claimed-utxos/mark"));
    expect(calledPath()).toBe("/api/umbra/claimed-utxos/mark");
    expect(calledMethod()).toBe("POST");
  });
});

describe("POST /api/umbra/dev/test-register", () => {
  beforeEach(setup);
  it("proxies POST to /api/umbra/dev/test-register", async () => {
    const { POST } = await import("@/app/api/umbra/dev/test-register/route");
    await POST(makePost("/api/umbra/dev/test-register"));
    expect(calledPath()).toBe("/api/umbra/dev/test-register");
    expect(calledMethod()).toBe("POST");
  });
});

describe("proxy response passthrough", () => {
  beforeEach(setup);

  it("returns the upstream status code unchanged (401)", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ error: "invalid signature" }),
    });
    const { POST } = await import("@/app/api/send/prepare/route");
    const res = await POST(makePost("/api/send/prepare"));
    expect(res.status).toBe(401);
  });

  it("returns the upstream body unchanged", async () => {
    const upstream = { activityId: "abc-123", unsignedTx: "cafebabe" };
    fetchMock.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve(upstream),
    });
    const { POST } = await import("@/app/api/send/prepare/route");
    const res = await POST(makePost("/api/send/prepare"));
    expect(await res.json()).toEqual(upstream);
  });

  it("forwards X-Session-Signature to swish-core", async () => {
    const { POST } = await import("@/app/api/send_claim/claim/route");
    const req = new NextRequest("http://localhost:3000/api/send_claim/claim", {
      method: "POST",
      body: JSON.stringify({ activityId: "x" }),
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": "sig-abc",
      },
    });
    await POST(req);
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["X-Session-Signature"]).toBe("sig-abc");
  });
});
