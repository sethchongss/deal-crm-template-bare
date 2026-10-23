import { consentErrorHtml, consentHtml } from "@/lib/mcp/consent";
import { clientIp, isLoginLimited, recordLoginFailure } from "@/lib/login-rate-limit";
import { verifyTeamPassword } from "@/lib/team-password";
import {
  OAuthError,
  authorizationServerMetadata,
  beginAuthorize,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  issueCode,
  protectedResourceMetadata,
  readClientCredentials,
  registerClient,
} from "@/lib/mcp/oauth";
import { publicOrigin } from "@/lib/mcp/hosts";
import { corsHeaders } from "@/lib/mcp/http";

export function metadataResponse(body: unknown) {
  return Response.json(body, { headers: { ...corsHeaders(), "Cache-Control": "no-store" } });
}

export function oauthJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...corsHeaders(), "Cache-Control": "no-store" } });
}

export function oauthFailure(error: unknown) {
  if (error instanceof OAuthError) {
    return oauthJson({ error: error.code, error_description: error.message }, error.status);
  }
  const message = error instanceof Error && error.message === "MCP_TOKEN_SECRET is not set"
    ? "MCP_TOKEN_SECRET is not set."
    : "The authorization server could not complete that request.";
  console.error("oauth error", error instanceof Error ? error.message : "unknown");
  return oauthJson({ error: "server_error", error_description: message }, 500);
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export function protectedResourceResponse(request: Request) {
  return metadataResponse(protectedResourceMetadata(publicOrigin(request)));
}

export function authorizationServerResponse(request: Request) {
  return metadataResponse(authorizationServerMetadata(publicOrigin(request)));
}

export async function registerResponse(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthJson({ error: "invalid_client_metadata", error_description: "Registration body must be JSON." }, 400);
  }
  if (!body || typeof body !== "object") {
    return oauthJson({ error: "invalid_client_metadata", error_description: "Registration body must be a JSON object." }, 400);
  }
  try {
    return oauthJson(await registerClient(body), 201);
  } catch (error) {
    return oauthFailure(error);
  }
}

export async function authorizeGet(request: Request) {
  const url = new URL(request.url);
  try {
    const begun = await beginAuthorize(request, {
      response_type: url.searchParams.get("response_type") ?? "",
      client_id: url.searchParams.get("client_id") ?? "",
      redirect_uri: url.searchParams.get("redirect_uri") ?? "",
      code_challenge: url.searchParams.get("code_challenge") ?? "",
      code_challenge_method: url.searchParams.get("code_challenge_method") ?? "",
      state: url.searchParams.get("state") ?? "",
      resource: url.searchParams.get("resource"),
    });
    return html(consentHtml({ txn: begun.txn, clientName: begun.clientName }));
  } catch (error) {
    if (error instanceof OAuthError) return html(consentErrorHtml(error.message), error.status);
    return oauthFailure(error);
  }
}

export async function authorizePost(request: Request) {
  const form = await request.formData();
  const txn = String(form.get("txn") ?? "");
  const password = String(form.get("password") ?? "");
  const actor = String(form.get("actor") ?? "");
  const ip = clientIp(request);
  const show = (error: string, status = 400) => html(consentHtml({ txn, clientName: "Claude", error }), status);

  if (isLoginLimited(ip, Date.now(), "mcp")) return show("Too many attempts. Wait 15 minutes and try again.", 429);
  if (password.length === 0 || password.length > 1024) {
    recordLoginFailure(ip, Date.now(), "mcp");
    return show("That password is incorrect.", 401);
  }
  const passwordHash = process.env.TEAM_PASSWORD_HASH;
  if (!passwordHash) return show("Team sign-in is not configured yet.", 500);
  if (!verifyTeamPassword(password, passwordHash)) {
    recordLoginFailure(ip, Date.now(), "mcp");
    return show("That password is incorrect.", 401);
  }
  try {
    const issued = await issueCode(txn, actor);
    return Response.redirect(issued.destination, 303);
  } catch (error) {
    if (error instanceof OAuthError) return show(error.message, error.status);
    return oauthFailure(error);
  }
}

async function tokenParams(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string") params.set(key, value);
    }
    return params;
  }
  return new URLSearchParams(await request.text());
}

export async function tokenResponse(request: Request) {
  try {
    const params = await tokenParams(request);
    const credentials = readClientCredentials(request, params);
    const grant = params.get("grant_type");
    const resource = params.get("resource");
    if (grant === "authorization_code") {
      const tokens = await exchangeAuthorizationCode({
        code: params.get("code") ?? "",
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        redirectUri: params.get("redirect_uri") ?? "",
        verifier: params.get("code_verifier") ?? "",
        resource,
      });
      return oauthJson(tokens);
    }
    if (grant === "refresh_token") {
      const tokens = await exchangeRefreshToken({
        refreshToken: params.get("refresh_token") ?? "",
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        resource,
      });
      return oauthJson(tokens);
    }
    return oauthJson({ error: "unsupported_grant_type", error_description: "Use authorization_code or refresh_token." }, 400);
  } catch (error) {
    return oauthFailure(error);
  }
}
