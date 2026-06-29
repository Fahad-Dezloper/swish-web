import { NextRequest, NextResponse } from "next/server";

const CORE_URL = process.env.SWISH_CORE_URL ?? "http://localhost:4000";
const CORE_KEY = process.env.SWISH_CORE_KEY;

export async function proxyToCore(req: NextRequest, path: string): Promise<NextResponse> {
  const url = new URL(path, CORE_URL);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  // Service-to-service auth: core's requireCoreKey gate matches this header.
  // No-op when unset (local dev) — core allows unauthenticated calls in dev.
  if (CORE_KEY) headers.set("x-swish-core-key", CORE_KEY);

  const isBodyless = req.method === "GET" || req.method === "HEAD";
  const init: RequestInit = { method: req.method, headers };
  if (!isBodyless) {
    init.body = await req.text();
  }

  const upstream = await fetch(url.toString(), init);
  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
