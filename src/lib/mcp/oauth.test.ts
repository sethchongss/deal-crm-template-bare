import assert from "node:assert/strict";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isLoginLimited, recordLoginFailure } from "@/lib/login-rate-limit";
import { isAllowedPublicHost, isAllowedResource, publicOrigin, resourceUrl } from "@/lib/mcp/hosts";
import {
  authorizationServerMetadata,
  beginAuthorize,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  issueCode,
  protectedResourceMetadata,
  registerClient,
  resetCimdCache,
  resolveClient,
  verifyAccessToken,
  wwwAuthenticate,
} from "@/lib/mcp/oauth";
import { clientRedirectAllowed, redirectAllowed, redirectMatches } from "@/lib/mcp/redirects";
import { pkceChallenge, readToken, resetUsedCodes, signToken } from "@/lib/mcp/tokens";

const SECRET = "test-mcp-token-secret-value";

const HOSTS = "crm.example.com";

test.before(() => {
  process.env.MCP_TOKEN_SECRET = SECRET;
  for (const name of ["VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_BRANCH_URL", "VERCEL_URL"]) delete process.env[name];
  process.env.APP_PUBLIC_HOSTS = HOSTS;
});

test.beforeEach(() => {
  resetUsedCodes();
  resetCimdCache();
});

function request(url: string, host?: string) {
  const headers = new Headers();
  if (host) headers.set("host", host);
  return new Request(url, { headers });
}

test("configured hosts are reflected and an unknown host is not", () => {
  process.env.APP_PUBLIC_HOSTS = "crm.example.com, team-crm.vercel.app";
  try {
    assert.equal(isAllowedPublicHost("crm.example.com"), true);
    assert.equal(isAllowedPublicHost("team-crm.vercel.app"), true);
    assert.equal(isAllowedPublicHost("team-crm-git-feature.vercel.app"), true);
    assert.equal(isAllowedPublicHost("localhost"), true);
    assert.equal(isAllowedPublicHost("evil.vercel.app"), false);
    assert.equal(isAllowedPublicHost("other.example.com"), false);

    const custom = request("https://team-crm.vercel.app/api/mcp", "team-crm.vercel.app");
    assert.equal(publicOrigin(custom), "https://team-crm.vercel.app");
    const metadata = authorizationServerMetadata(publicOrigin(custom));
    assert.equal(metadata.issuer, "https://team-crm.vercel.app");
    assert.equal(metadata.authorization_endpoint, "https://team-crm.vercel.app/api/oauth/authorize");
    assert.equal(protectedResourceMetadata(publicOrigin(custom)).resource, "https://team-crm.vercel.app/api/mcp");

    const evil = request("https://evil.example/api/mcp", "evil.example");
    assert.equal(publicOrigin(evil), "https://crm.example.com");
    assert.equal(resourceUrl(publicOrigin(evil)), "https://crm.example.com/api/mcp");
    assert.equal(isAllowedResource("https://evil.example/api/mcp"), false);
    assert.equal(isAllowedResource("https://crm.example.com/api/mcp"), true);
    assert.equal(isAllowedResource("http://crm.example.com/api/mcp"), false);
  } finally {
    process.env.APP_PUBLIC_HOSTS = HOSTS;
  }
});

test("the deploy's own Vercel host is allowed, and with nothing configured the fallback is localhost", () => {
  delete process.env.APP_PUBLIC_HOSTS;
  try {
    assert.equal(isAllowedPublicHost("team-crm.vercel.app"), false);
    assert.equal(publicOrigin(request("https://evil.example/api/mcp", "evil.example")), "http://localhost:3000");
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "my-crm.vercel.app";
    assert.equal(isAllowedPublicHost("my-crm.vercel.app"), true);
    assert.equal(isAllowedPublicHost("my-crm-git-branch.vercel.app"), true);
    assert.equal(publicOrigin(request("https://evil.example/api/mcp", "evil.example")), "https://my-crm.vercel.app");
  } finally {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.APP_PUBLIC_HOSTS = HOSTS;
  }
});

test("redirects allow Claude callbacks and port-agnostic loopback only", () => {
  assert.equal(redirectAllowed("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(redirectAllowed("https://claude.com/api/mcp/auth_callback"), true);
  assert.equal(redirectAllowed("http://127.0.0.1:43123/callback"), true);
  assert.equal(redirectAllowed("http://localhost:9/callback"), true);
  assert.equal(redirectAllowed("javascript:alert(1)"), false);
  assert.equal(redirectAllowed("https://evil.example/api/mcp/auth_callback"), false);
  assert.equal(redirectAllowed("https://claude.ai.evil.example/api/mcp/auth_callback"), false);
  assert.equal(redirectMatches("http://127.0.0.1:9/callback", "http://127.0.0.1/callback"), true);
  assert.equal(redirectMatches("http://localhost:3456/callback", "http://localhost/callback"), true);
  assert.equal(clientRedirectAllowed("http://127.0.0.1:9/callback", ["http://127.0.0.1/callback"]), true);
  assert.equal(
    clientRedirectAllowed("https://claude.ai/api/mcp/auth_callback", ["https://claude.com/api/mcp/auth_callback"]),
    false,
  );
});

test("tokens reject tampering and expiry", async () => {
  const now = 1_700_000_000_000;
  const token = await signToken({
    typ: "access",
    client_id: "client",
    resource: "https://crm.example.com/api/mcp",
    actor: "Member 1",
    exp: now + 1000,
    jti: "jti-1",
  });
  const read = await readToken(token, "access", now);
  assert.equal(read?.actor, "Member 1");
  const flipped = token.endsWith("a") ? `${token.slice(0, -1)}b` : `${token.slice(0, -1)}a`;
  assert.equal(await readToken(flipped, "access", now), null);
  assert.equal(await readToken(token, "access", now + 1000), null);
  assert.equal(await readToken(token, "refresh", now), null);
});

test("dynamic registration keeps only the grants this server supports", async () => {
  const registered = await registerClient({
    client_name: "Claude",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"],
    grant_types: ["authorization_code", "refresh_token", "client_credentials"],
    token_endpoint_auth_method: "none",
  });
  assert.deepEqual(registered.grant_types, ["authorization_code", "refresh_token"]);
  assert.equal(registered.client_secret, undefined);
  await assert.rejects(
    () => registerClient({ redirect_uris: ["https://evil.example/callback"], token_endpoint_auth_method: "none" }),
    /Claude callback/,
  );
});

test("authorization code is single use and PKCE must match", async () => {
  const registered = await registerClient({
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    token_endpoint_auth_method: "none",
  });
  const verifier = randomBytes(32).toString("base64url");
  const challenge = pkceChallenge(verifier);
  const resource = "https://crm.example.com/api/mcp";
  const begun = await beginAuthorize(request("https://crm.example.com/api/oauth/authorize", "crm.example.com"), {
    response_type: "code",
    client_id: registered.client_id,
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "abc",
    resource,
  });
  const mismatch = await issueCode(begun.txn, "member 1");
  const mismatchCode = new URL(mismatch.destination).searchParams.get("code");
  assert.ok(mismatchCode);
  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        code: mismatchCode,
        clientId: registered.client_id,
        clientSecret: null,
        redirectUri: "https://claude.ai/api/mcp/auth_callback",
        verifier: "a".repeat(50),
        resource,
      }),
    /PKCE/,
  );

  const issued = await issueCode(begun.txn, "member 1");
  assert.equal(issued.actor, "Member 1");
  const code = new URL(issued.destination).searchParams.get("code");
  assert.ok(code);

  const tokens = await exchangeAuthorizationCode({
    code: code!,
    clientId: registered.client_id,
    clientSecret: null,
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
    verifier,
    resource,
  });
  const access = await verifyAccessToken(tokens.access_token, resource);
  assert.equal(access?.actor, "Member 1");
  assert.equal(await verifyAccessToken(tokens.access_token, "https://other.example.com/api/mcp"), null);

  await assert.rejects(
    () =>
      exchangeAuthorizationCode({
        code: code!,
        clientId: registered.client_id,
        clientSecret: null,
        redirectUri: "https://claude.ai/api/mcp/auth_callback",
        verifier,
        resource,
      }),
    /already used/,
  );

  const refreshed = await exchangeRefreshToken({
    refreshToken: tokens.refresh_token,
    clientId: registered.client_id,
    clientSecret: null,
    resource,
  });
  assert.equal(typeof refreshed.access_token, "string");
  assert.notEqual(refreshed.access_token, tokens.access_token);
});

test("client metadata documents are accepted only from Claude and only for allowed redirects", async () => {
  const clientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), clientId);
    return new Response(
      JSON.stringify({
        client_id: clientId,
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback", "javascript:alert(1)"],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const client = await resolveClient(clientId);
    assert.deepEqual(client.redirect_uris, ["https://claude.ai/api/mcp/auth_callback"]);
    await assert.rejects(() => resolveClient("https://evil.example/oauth/client"), /claude\.ai or claude\.com/);
  } finally {
    globalThis.fetch = original;
  }
});

test("unauthenticated resource metadata points at the path-inserted well-known URL", () => {
  const header = wwwAuthenticate("https://crm.example.com");
  assert.match(header, /resource_metadata="https:\/\/crm\.example\.com\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
  const metadata = authorizationServerMetadata("https://crm.example.com");
  assert.equal(metadata.client_id_metadata_document_supported, true);
  assert.ok(metadata.token_endpoint_auth_methods_supported.includes("none"));
});

test("consent failures are counted per bucket", () => {
  const ip = "203.0.113.44";
  const now = Date.now();
  for (let attempt = 0; attempt < 8; attempt += 1) recordLoginFailure(ip, now, "mcp");
  assert.equal(isLoginLimited(ip, now, "mcp"), true);
  assert.equal(isLoginLimited(ip, now, "web"), false);
});

test("the audit migration tags Claude without rewriting deal rows", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261003160000_audit_source.sql", import.meta.url), "utf8");
  assert.match(sql, /x-crm-source/);
  assert.match(sql, /x-crm-actor/);
  for (const name of ["Member 1", "Member 2", "Member 3"]) assert.match(sql, new RegExp(name));
  assert.equal(sql.includes("UPDATE public.deals"), false);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.undo_claude_change/);
  const challenge = createHash("sha256").update("verifier").digest("base64url");
  assert.equal(pkceChallenge("verifier"), challenge);
  const hash = scryptSync("unused", Buffer.alloc(16), 64, { N: 16384, r: 8, p: 1 });
  assert.equal(hash.length, 64);
});
