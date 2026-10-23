/**
 * Team allow-list. Set TEAM_ALLOWED_EMAILS to a comma-separated list, e.g.
 * "team@example.com,ops@example.com". The first address is the shared login the
 * server signs in as. Keep private.is_team() in the lockdown migration in step.
 */
export function parseAllowedEmails(raw: string | undefined | null): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));
  return list.length > 0 ? [...new Set(list)] : ["team@example.com"];
}

export const TEAM_ALLOWED_EMAILS = parseAllowedEmails(process.env.TEAM_ALLOWED_EMAILS);
export const TEAM_EMAIL = TEAM_ALLOWED_EMAILS[0];
export const SESSION_COOKIE = "team_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\n")) {
    return "/";
  }
  return value;
}

export function isTeamEmailClaim(email: unknown) {
  return typeof email === "string" && TEAM_ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

export function requestIsSecure(request: Request) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return new URL(request.url).protocol === "https:";
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(secret: string, now = Date.now()) {
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ exp: now + SESSION_MAX_AGE_SECONDS * 1000 })),
  );
  const key = await hmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature) return false;

  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return false;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}
