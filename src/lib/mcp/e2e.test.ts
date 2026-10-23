import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, scryptSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { POST as mcpPost } from "@/app/api/mcp/route";
import { GET as authorizeGet, POST as authorizePost } from "@/app/api/oauth/authorize/route";
import { POST as registerPost } from "@/app/api/oauth/register/route";
import { POST as tokenPost } from "@/app/api/oauth/token/route";
import { GET as resourceGet } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";
import { resetMcpLimits } from "@/lib/mcp/limits";
import { resetSharedMemoryStore } from "@/lib/mcp/memory-store";
import { pkceChallenge, resetUsedCodes } from "@/lib/mcp/tokens";
import { CRM_TOOL_NAMES } from "@/lib/mcp/tools";

const PASSWORD = "connector-test-password";

function teamHash(password: string) {
  const salt = Buffer.from("0123456789abcdef");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1:${salt.toString("base64")}:${hash.toString("base64")}`;
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function toWebRequest(req: IncomingMessage, origin: string) {
  const url = new URL(req.url ?? "/", origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value) headers.set(key, value);
  }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  return new Request(url, { method: req.method, headers, body: body && body.length > 0 ? body : undefined });
}

async function writeWebResponse(res: ServerResponse, response: Response) {
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

test("oauth then mcp create and undo on the local connector", async () => {
  process.env.MCP_TOKEN_SECRET = "test-mcp-token-secret-value";
  process.env.TEAM_PASSWORD_HASH = teamHash(PASSWORD);
  process.env.MCP_E2E_MEMORY = "1";
  delete process.env.VERCEL;
  resetUsedCodes();
  resetMcpLimits();
  resetSharedMemoryStore();

  const server = createServer(async (req, res) => {
    try {
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const request = await toWebRequest(req, origin);
      const path = new URL(request.url).pathname;
      let response: Response;
      if (path === "/api/oauth/register" && req.method === "POST") response = await registerPost(request);
      else if (path === "/api/oauth/authorize" && req.method === "GET") response = await authorizeGet(request);
      else if (path === "/api/oauth/authorize" && req.method === "POST") response = await authorizePost(request);
      else if (path === "/api/oauth/token" && req.method === "POST") response = await tokenPost(request);
      else if (path === "/.well-known/oauth-protected-resource/api/mcp" && req.method === "GET") response = await resourceGet(request);
      else if (path === "/api/mcp") response = await mcpPost(request);
      else response = new Response("not found", { status: 404 });
      await writeWebResponse(res, response);
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(error instanceof Error ? error.stack ?? error.message : "error");
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  const resource = `${origin}/api/mcp`;
  const redirectUri = "https://claude.ai/api/mcp/auth_callback";

  try {
    const denied = await fetch(resource, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(denied.status, 401);
    const challenge = denied.headers.get("www-authenticate") ?? "";
    assert.match(challenge, new RegExp(`resource_metadata="${origin}/\\.well-known/oauth-protected-resource/api/mcp"`));

    const metadata = await fetch(`${origin}/.well-known/oauth-protected-resource/api/mcp`);
    const metadataBody = (await metadata.json()) as { resource: string };
    assert.equal(metadataBody.resource, resource);

    const registeredResponse = await fetch(`${origin}/api/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Claude test",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token", "client_credentials"],
        token_endpoint_auth_method: "none",
      }),
    });
    assert.equal(registeredResponse.status, 201);
    const registered = (await registeredResponse.json()) as { client_id: string; grant_types: string[] };
    assert.deepEqual(registered.grant_types, ["authorization_code", "refresh_token"]);

    const verifier = randomBytes(32).toString("base64url");
    const state = "state-1";
    const authorizeUrl = new URL(`${origin}/api/oauth/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", registered.client_id);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("code_challenge", pkceChallenge(verifier));
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("resource", resource);
    const consent = await fetch(authorizeUrl, { headers: { "x-forwarded-for": "203.0.113.10" } });
    const html = await consent.text();
    const txn = html.match(/name="txn" value="([^"]+)"/)?.[1];
    assert.ok(txn, html.slice(0, 300));

    const wrong = await fetch(`${origin}/api/oauth/authorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "203.0.113.10" },
      body: new URLSearchParams({ txn, password: "nope", actor: "Member 1" }),
      redirect: "manual",
    });
    assert.equal(wrong.status, 401);
    assert.match(await wrong.text(), /incorrect/i);

    const allowed = await fetch(`${origin}/api/oauth/authorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "203.0.113.10" },
      body: new URLSearchParams({ txn, password: PASSWORD, actor: "Member 1" }),
      redirect: "manual",
    });
    assert.equal(allowed.status, 303);
    const location = new URL(allowed.headers.get("location") ?? "");
    assert.equal(location.origin + location.pathname, redirectUri);
    assert.equal(location.searchParams.get("state"), state);
    const code = location.searchParams.get("code");
    assert.ok(code);

    const tokenResponse = await fetch(`${origin}/api/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: registered.client_id,
        code_verifier: verifier,
        resource,
      }),
    });
    assert.equal(tokenResponse.status, 200);
    const tokens = (await tokenResponse.json()) as { access_token: string; token_type: string };
    assert.equal(tokens.token_type, "Bearer");

    const client = new Client({ name: "deal-crm-template-e2e", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      authProvider: { token: async () => tokens.access_token },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    for (const name of CRM_TOOL_NAMES) {
      assert.equal(listed.tools.some((tool) => tool.name === name), true, name);
    }

    const created = await client.callTool({
      name: "create_deal",
      arguments: { name: "deal-1", company: "Company A", revenue: 12, currency: "SGD" },
    });
    assert.equal(created.isError, undefined);
    const createdText = (created.content as { text: string }[])[0]?.text ?? "";
    const createdBody = JSON.parse(createdText) as { audit_id: string; deal: { company_name: string; sales_amount: number } };
    assert.equal(createdBody.deal.company_name, "deal-1");
    assert.equal(createdBody.deal.sales_amount, 12);

    const undone = await client.callTool({ name: "undo_change", arguments: { audit_id: createdBody.audit_id } });
    const undoneBody = JSON.parse((undone.content as { text: string }[])[0]?.text ?? "") as { undone: boolean; reversal: string };
    assert.equal(undoneBody.undone, true);
    assert.equal(undoneBody.reversal, "delete");
    await client.close();
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
