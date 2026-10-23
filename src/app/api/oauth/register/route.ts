import { registerResponse } from "@/lib/mcp/oauth-http";
import { corsHeaders } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function POST(request: Request) {
  return registerResponse(request);
}
