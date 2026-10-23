import { corsHeaders, handleMcp, withCors } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function respond(request: Request) {
  return withCors(await handleMcp(request));
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export const GET = respond;
export const POST = respond;
export const DELETE = respond;
