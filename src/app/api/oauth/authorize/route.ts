import { authorizeGet, authorizePost } from "@/lib/mcp/oauth-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return authorizeGet(request);
}

export function POST(request: Request) {
  return authorizePost(request);
}
