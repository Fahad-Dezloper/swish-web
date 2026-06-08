import { NextRequest } from "next/server";
import { proxyToCore } from "@/lib/proxy";

export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/withdraw/submit");
}
