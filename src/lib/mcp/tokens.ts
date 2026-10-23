import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const TXN_TTL_MS = 10 * 60 * 1000;

export const TOKEN_TTLS = { ACCESS_TTL_MS, REFRESH_TTL_MS, CODE_TTL_MS, TXN_TTL_MS };

type TokenType = "client" | "code" | "access" | "refresh" | "txn";

export type ClientRecord = {
  typ: "client";
  name: string;
  redirect_uris: string[];
  auth_method: "none" | "client_secret_post" | "client_secret_basic";
  secret_hash: string | null;
  iat: number;
};

export type CodeRecord = {
  typ: "code";
  client_id: string;
  redirect_uri: string;
  challenge: string;
  resource: string;
  actor: string | null;
  exp: number;
  jti: string;
};

export type AccessRecord = {
  typ: "access";
  client_id: string;
  resource: string;
  actor: string | null;
  exp: number;
  jti: string;
};

export type RefreshRecord = {
  typ: "refresh";
  client_id: string;
  resource: string;
  actor: string | null;
  exp: number;
  jti: string;
};

export type TxnRecord = {
  typ: "txn";
  client_id: string;
  redirect_uri: string;
  challenge: string;
  resource: string;
  state: string;
  exp: number;
};

type RecordByType = {
  client: ClientRecord;
  code: CodeRecord;
  access: AccessRecord;
  refresh: RefreshRecord;
  txn: TxnRecord;
};

function secret() {
  const value = process.env.MCP_TOKEN_SECRET;
  if (!value || value.length < 16) return null;
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function hmacKey(value: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(payload: RecordByType[TokenType]) {
  const keyMaterial = secret();
  if (!keyMaterial) throw new Error("MCP_TOKEN_SECRET is not set");
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(keyMaterial);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${bytesToBase64Url(signature)}`;
}

export async function readToken<T extends TokenType>(token: string, typ: T, now = Date.now()): Promise<RecordByType[T] | null> {
  const keyMaterial = secret();
  if (!keyMaterial || !token || token.length > 8000) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!body || !signature || token.includes(".", dot + 1)) return null;
  try {
    const key = await hmacKey(keyMaterial);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), new TextEncoder().encode(body));
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as RecordByType[T];
    if (!parsed || parsed.typ !== typ) return null;
    if ("exp" in parsed && typeof parsed.exp === "number" && parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function randomId() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function secretsMatch(value: string, hashed: string) {
  const actual = Buffer.from(hashSecret(value), "hex");
  const expected = Buffer.from(hashed, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

const usedCodes = new Map<string, number>();

export function rememberCode(jti: string, exp: number, now = Date.now()) {
  for (const [id, until] of usedCodes) {
    if (until <= now) usedCodes.delete(id);
  }
  if (usedCodes.has(jti)) return false;
  usedCodes.set(jti, exp);
  return true;
}

export function resetUsedCodes() {
  usedCodes.clear();
}
