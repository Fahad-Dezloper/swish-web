import { NextRequest } from "next/server";
import { proxyToCore } from "@/lib/proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToCore(req, `/api/send_claim/${id}`);
}
