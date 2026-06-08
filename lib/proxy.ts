import { NextRequest, NextResponse } from "next/server";

const CORE_URL = process.env.SWISH_CORE_URL;

if (!CORE_URL) {
  throw new Error("SWISH_CORE_URL is not set");
}

export async function proxyToCore(
  req: NextRequest,
  path: string
): Promise<NextResponse> {
  const url = new URL(path, CORE_URL);

  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const sessionSig = req.headers.get("X-Session-Signature");
  if (sessionSig) {
    headers["X-Session-Signature"] = sessionSig;
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const json = await req.json();
      body = JSON.stringify(json);
    } catch {
      // Body might be empty (no JSON) — that's fine
    }
  }

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
