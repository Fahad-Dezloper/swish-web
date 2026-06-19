import { type NextRequest } from "next/server";
import { proxyToCore } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  return proxyToCore(req, "/api/fee");
}
