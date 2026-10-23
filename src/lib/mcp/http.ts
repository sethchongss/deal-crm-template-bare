import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { CrmError } from "@/lib/mcp/deal-write";
import { publicOrigin, resourceUrl } from "@/lib/mcp/hosts";
import { consumeMcpCall } from "@/lib/mcp/limits";
import { openStore } from "@/lib/mcp/open-store";
import { verifyAccessToken } from "@/lib/mcp/oauth";
import { registerCrmPrompts } from "@/lib/mcp/prompts";
import { registerCrmTools, SERVER_INSTRUCTIONS, type CrmStore } from "@/lib/mcp/tools";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version, Mcp-Session-Id",
    "Cache-Control": "no-store",
  };
}

export function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function handleMcp(request: Request) {
  const origin = publicOrigin(request);
  const resource = resourceUrl(origin);
  const handler = createMcpHandler(
    (server) => {
      const openActor = () => {
        const extra = request.auth?.extra;
        const actor = typeof extra?.actor === "string" ? extra.actor : null;
        const jti = typeof extra?.jti === "string" ? extra.jti : "anonymous";
        if (!consumeMcpCall(jti)) throw new CrmError("Rate limit reached. Wait a minute and try again.");
        return actor;
      };
      registerCrmTools(server, async () => (await openStore(openActor())) as unknown as CrmStore);
      registerCrmPrompts(server);
    },
    {
      serverInfo: { name: "deal-crm-template", version: "1.0.0" },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  return withMcpAuth(
    handler,
    async (_request, bearer) => {
      if (!bearer) return undefined;
      const access = await verifyAccessToken(bearer, resource);
      if (!access) return undefined;
      const info: AuthInfo = {
        token: bearer,
        clientId: access.client_id,
        scopes: ["crm"],
        expiresAt: Math.floor(access.exp / 1000),
        resource: new URL(access.resource),
        extra: { actor: access.actor, jti: access.jti },
      };
      return info;
    },
    {
      required: true,
      requiredScopes: ["crm"],
      // mcp-handler treats this as the public origin and appends resourceMetadataPath.
      resourceUrl: origin,
      resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
    },
  )(request);
}
