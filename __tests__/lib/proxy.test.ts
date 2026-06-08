import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxyToCore } from "@/lib/proxy";

function makeFetchMock(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(body),
  });
}

describe("proxyToCore", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("forwards GET request to the correct swish-core URL", async () => {
    const mock = makeFetchMock(200, { ok: true });
    global.fetch = mock as any;

    const req = new NextRequest("http://localhost:3000/api/fee");
    await proxyToCore(req, "/api/fee");

    expect(mock).toHaveBeenCalledOnce();
    const [url, init] = mock.mock.calls[0];
    expect(url).toContain("http://localhost:4000/api/fee");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("forwards query params from the original request", async () => {
    const mock = makeFetchMock(200, {});
    global.fetch = mock as any;

    const req = new NextRequest(
      "http://localhost:3000/api/activity/user?address=ABC123"
    );
    await proxyToCore(req, "/api/activity/user");

    const [url] = mock.mock.calls[0];
    expect(url).toContain("address=ABC123");
  });

  it("forwards POST body as JSON", async () => {
    const mock = makeFetchMock(200, { activityId: "xyz" });
    global.fetch = mock as any;

    const req = new NextRequest("http://localhost:3000/api/send/prepare", {
      method: "POST",
      body: JSON.stringify({ amount: 10, token: "USDC" }),
      headers: { "Content-Type": "application/json" },
    });
    await proxyToCore(req, "/api/send/prepare");

    const [, init] = mock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ amount: 10, token: "USDC" });
  });

  it("forwards X-Session-Signature header", async () => {
    const mock = makeFetchMock(200, {});
    global.fetch = mock as any;

    const sig = "base64signaturehere";
    const req = new NextRequest("http://localhost:3000/api/send/prepare", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": sig,
      },
    });
    await proxyToCore(req, "/api/send/prepare");

    const [, init] = mock.mock.calls[0];
    expect(init.headers["X-Session-Signature"]).toBe(sig);
  });

  it("does NOT add X-Session-Signature when not present in request", async () => {
    const mock = makeFetchMock(200, {});
    global.fetch = mock as any;

    const req = new NextRequest("http://localhost:3000/api/fee");
    await proxyToCore(req, "/api/fee");

    const [, init] = mock.mock.calls[0];
    expect(init.headers["X-Session-Signature"]).toBeUndefined();
  });

  it("preserves upstream status code 401", async () => {
    global.fetch = makeFetchMock(401, { error: "unauthorized" }) as any;

    const req = new NextRequest("http://localhost:3000/api/activity/user");
    const res = await proxyToCore(req, "/api/activity/user");

    expect(res.status).toBe(401);
  });

  it("preserves upstream status code 500", async () => {
    global.fetch = makeFetchMock(500, { error: "server error" }) as any;

    const req = new NextRequest("http://localhost:3000/api/send/prepare", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    const res = await proxyToCore(req, "/api/send/prepare");

    expect(res.status).toBe(500);
  });

  it("returns the upstream JSON body", async () => {
    const upstream = { activityId: "abc-123", tx: "deadbeef" };
    global.fetch = makeFetchMock(200, upstream) as any;

    const req = new NextRequest("http://localhost:3000/api/send/prepare", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    const res = await proxyToCore(req, "/api/send/prepare");
    const body = await res.json();

    expect(body).toEqual(upstream);
  });

  it("gracefully returns empty object when upstream body is not JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.reject(new SyntaxError("Not JSON")),
    }) as any;

    const req = new NextRequest("http://localhost:3000/api/fee");
    const res = await proxyToCore(req, "/api/fee");
    const body = await res.json();

    expect(body).toEqual({});
  });
});
