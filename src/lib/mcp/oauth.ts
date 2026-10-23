import { canonicalActor } from "@/lib/mcp/team";
import { APP_NAME } from "@/lib/brand";
import { isAllowedResource, publicOrigin, resourceUrl } from "@/lib/mcp/hosts";
import { clientRedirectAllowed, redirectAllowed } from "@/lib/mcp/redirects";
import {
  TOKEN_TTLS,
  hashSecret,
  pkceChallenge,
  randomId,
  readToken,
  rememberCode,
  secretsMatch,
  signToken,
  type ClientRecord,
} from "@/lib/mcp/tokens";

const SCOPE = "crm";
const CIMD_HOSTS = new Set(["claude.ai", "claude.com"]);
const cimdCache = new Map<string, { expires: number; record: ClientRecord }>();

export class OAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    client_id_metadata_document_supported: true,
    scopes_supported: [SCOPE],
    revocation_endpoint_auth_methods_supported: ["none"],
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: resourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: APP_NAME,
  };
}

export function wwwAuthenticate(origin: string, description = "Authentication required") {
  const metadata = `${origin}/.well-known/oauth-protected-resource/api/mcp`;
  return `Bearer error="invalid_token", error_description="${description}", resource_metadata="${metadata}", scope="${SCOPE}"`;
}

type RegisterBody = {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
};

export async function registerClient(body: RegisterBody, now = Date.now()) {
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0 || body.redirect_uris.length > 5) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris must list 1 to 5 callback URLs.");
  }
  const redirectUris: string[] = [];
  for (const item of body.redirect_uris) {
    if (typeof item !== "string" || !redirectAllowed(item)) {
      throw new OAuthError(
        "invalid_redirect_uri",
        "Redirect URI must be a Claude callback (https://claude.ai/api/mcp/auth_callback or https://claude.com/api/mcp/auth_callback) or an http loopback /callback.",
      );
    }
    redirectUris.push(item);
  }
  const grants = Array.isArray(body.grant_types) ? body.grant_types.filter((item) => item === "authorization_code" || item === "refresh_token") : ["authorization_code", "refresh_token"];
  if (!grants.includes("authorization_code")) {
    throw new OAuthError("invalid_client_metadata", "authorization_code is required.");
  }
  if (body.response_types != null && (!Array.isArray(body.response_types) || !body.response_types.includes("code"))) {
    throw new OAuthError("invalid_client_metadata", "Only the code response type is supported.");
  }
  const requested = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  const authMethod = requested === "client_secret_post" || requested === "client_secret_basic" || requested === "none" ? requested : null;
  if (!authMethod) {
    throw new OAuthError("invalid_client_metadata", "token_endpoint_auth_method must be none, client_secret_post, or client_secret_basic.");
  }
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 120) : "MCP client";
  const secret = authMethod === "none" ? null : randomId();
  const record: ClientRecord = {
    typ: "client",
    name,
    redirect_uris: redirectUris,
    auth_method: authMethod,
    secret_hash: secret ? hashSecret(secret) : null,
    iat: now,
  };
  const clientId = await signToken(record);
  return {
    client_id: clientId,
    client_secret: secret ?? undefined,
    client_id_issued_at: Math.floor(now / 1000),
    client_secret_expires_at: 0,
    client_name: name,
    redirect_uris: redirectUris,
    grant_types: grants.includes("refresh_token") ? ["authorization_code", "refresh_token"] : ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: authMethod,
  };
}

async function fetchCimd(clientId: string, now: number): Promise<ClientRecord> {
  const cached = cimdCache.get(clientId);
  if (cached && cached.expires > now) return cached.record;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    throw new OAuthError("invalid_client", "Unknown client_id.", 401);
  }
  if (url.protocol !== "https:" || !CIMD_HOSTS.has(url.hostname) || url.username || url.port) {
    throw new OAuthError("invalid_client", "Client metadata documents are only accepted from claude.ai or claude.com.", 401);
  }
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new OAuthError("invalid_client", "Could not fetch the client metadata document.", 401);
  const text = await response.text();
  if (text.length > 65536) throw new OAuthError("invalid_client", "Client metadata document is too large.", 401);
  const document = JSON.parse(text) as { client_id?: unknown; client_name?: unknown; redirect_uris?: unknown; token_endpoint_auth_method?: unknown };
  if (document.client_id !== clientId) throw new OAuthError("invalid_client", "Client metadata document is not self-referential.", 401);
  if (!Array.isArray(document.redirect_uris)) throw new OAuthError("invalid_client", "Client metadata is missing redirect_uris.", 401);
  const redirectUris = document.redirect_uris.filter((item): item is string => typeof item === "string" && redirectAllowed(item));
  if (redirectUris.length === 0) throw new OAuthError("invalid_client", "Client metadata has no allowed redirect URI.", 401);
  const record: ClientRecord = {
    typ: "client",
    name: typeof document.client_name === "string" ? document.client_name.slice(0, 120) : url.hostname,
    redirect_uris: redirectUris,
    auth_method: "none",
    secret_hash: null,
    iat: now,
  };
  cimdCache.set(clientId, { expires: now + 10 * 60 * 1000, record });
  return record;
}

export async function resolveClient(clientId: string, now = Date.now()): Promise<ClientRecord & { client_id: string }> {
  if (!clientId || clientId.length > 8000) throw new OAuthError("invalid_client", "Unknown client_id.", 401);
  if (clientId.startsWith("https://")) {
    const record = await fetchCimd(clientId, now);
    return { ...record, client_id: clientId };
  }
  const record = await readToken(clientId, "client", now);
  if (!record) throw new OAuthError("invalid_client", "Unknown client_id.", 401);
  return { ...record, client_id: clientId };
}

export function assertClientSecret(client: ClientRecord, presented: string | null) {
  if (client.auth_method === "none") return;
  if (!presented || !client.secret_hash || !secretsMatch(presented, client.secret_hash)) {
    throw new OAuthError("invalid_client", "Client authentication failed.", 401);
  }
}

export type AuthorizeInput = {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  resource: string | null;
  response_type: string;
};

export async function beginAuthorize(request: Request, input: AuthorizeInput, now = Date.now()) {
  if (input.response_type !== "code") throw new OAuthError("unsupported_response_type", "Only response_type=code is supported.");
  if (input.code_challenge_method !== "S256") throw new OAuthError("invalid_request", "PKCE S256 is required.");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(input.code_challenge)) throw new OAuthError("invalid_request", "code_challenge is missing or not S256.");
  if (!input.state || input.state.length > 512) throw new OAuthError("invalid_request", "state is required.");
  const origin = publicOrigin(request);
  const resource = input.resource || resourceUrl(origin);
  if (!isAllowedResource(resource)) throw new OAuthError("invalid_target", "resource must be this CRM's /api/mcp URL.");
  const client = await resolveClient(input.client_id, now);
  if (!clientRedirectAllowed(input.redirect_uri, client.redirect_uris)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uri is not registered for this client.");
  }
  const txn = await signToken({
    typ: "txn",
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    challenge: input.code_challenge,
    resource,
    state: input.state,
    exp: now + TOKEN_TTLS.TXN_TTL_MS,
  });
  return { txn, clientName: client.name, origin, resource };
}

export async function issueCode(txnToken: string, actorRaw: string | null, now = Date.now()) {
  const txn = await readToken(txnToken, "txn", now);
  if (!txn) throw new OAuthError("invalid_request", "This sign-in form expired. Start the connection again from Claude.");
  const actor = actorRaw?.trim() ? canonicalActor(actorRaw) : null;
  if (actorRaw?.trim() && !actor) {
    throw new OAuthError("invalid_request", "Choose your name from the team list, or leave it blank.");
  }
  const code = await signToken({
    typ: "code",
    client_id: txn.client_id,
    redirect_uri: txn.redirect_uri,
    challenge: txn.challenge,
    resource: txn.resource,
    actor,
    exp: now + TOKEN_TTLS.CODE_TTL_MS,
    jti: randomId(),
  });
  const destination = new URL(txn.redirect_uri);
  destination.searchParams.set("code", code);
  destination.searchParams.set("state", txn.state);
  return { destination, actor };
}

export function readClientCredentials(request: Request, params: URLSearchParams) {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep <= 0) throw new OAuthError("invalid_client", "Client authentication failed.", 401);
    return {
      clientId: decodeURIComponent(decoded.slice(0, sep)),
      clientSecret: decodeURIComponent(decoded.slice(sep + 1)),
    };
  }
  return {
    clientId: params.get("client_id") ?? "",
    clientSecret: params.get("client_secret"),
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  verifier: string;
  resource: string | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const code = await readToken(input.code, "code", now);
  if (!code) throw new OAuthError("invalid_grant", "Authorization code is invalid or expired.");
  if (!rememberCode(code.jti, code.exp, now)) throw new OAuthError("invalid_grant", "Authorization code was already used.");
  if (code.client_id !== input.clientId) throw new OAuthError("invalid_grant", "Authorization code was issued to a different client.");
  if (code.redirect_uri !== input.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri does not match.");
  if (input.resource && input.resource !== code.resource) throw new OAuthError("invalid_target", "resource does not match the authorization request.");
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.verifier) || pkceChallenge(input.verifier) !== code.challenge) {
    throw new OAuthError("invalid_grant", "PKCE verification failed.");
  }
  const client = await resolveClient(code.client_id, now);
  assertClientSecret(client, input.clientSecret);
  return issueTokens({ clientId: code.client_id, resource: code.resource, actor: code.actor, now });
}

export async function exchangeRefreshToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string | null;
  resource: string | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const refresh = await readToken(input.refreshToken, "refresh", now);
  if (!refresh) throw new OAuthError("invalid_grant", "Refresh token is invalid or expired.");
  if (input.clientId && refresh.client_id !== input.clientId) throw new OAuthError("invalid_grant", "Refresh token was issued to a different client.");
  if (input.resource && input.resource !== refresh.resource) throw new OAuthError("invalid_target", "resource does not match.");
  const client = await resolveClient(refresh.client_id, now);
  assertClientSecret(client, input.clientSecret);
  return issueTokens({ clientId: refresh.client_id, resource: refresh.resource, actor: refresh.actor, now });
}

async function issueTokens(input: { clientId: string; resource: string; actor: string | null; now: number }) {
  const access = await signToken({
    typ: "access",
    client_id: input.clientId,
    resource: input.resource,
    actor: input.actor,
    exp: input.now + TOKEN_TTLS.ACCESS_TTL_MS,
    jti: randomId(),
  });
  const refresh = await signToken({
    typ: "refresh",
    client_id: input.clientId,
    resource: input.resource,
    actor: input.actor,
    exp: input.now + TOKEN_TTLS.REFRESH_TTL_MS,
    jti: randomId(),
  });
  return {
    access_token: access,
    token_type: "Bearer" as const,
    expires_in: TOKEN_TTLS.ACCESS_TTL_MS / 1000,
    refresh_token: refresh,
    scope: SCOPE,
  };
}

export async function verifyAccessToken(token: string, expectedResource: string, now = Date.now()) {
  const access = await readToken(token, "access", now);
  if (!access || access.resource !== expectedResource) return null;
  return access;
}

export function resetCimdCache() {
  cimdCache.clear();
}
