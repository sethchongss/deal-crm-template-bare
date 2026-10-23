import { authorizationServerResponse } from "@/lib/mcp/oauth-http";
import { corsHeaders } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function GET(request: Request) {
  return authorizationServerResponse(request);
}