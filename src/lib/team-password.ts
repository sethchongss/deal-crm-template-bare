import { scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const HASH_BYTES = 64;

export function verifyTeamPassword(password: string, encoded: string) {
  if (encoded.length > 256) return false;
  const parts = encoded.split(":");
  if (parts.length !== 6) return false;
  const [scheme, n, r, p, saltB64, hashB64] = parts;
  if (scheme !== "scrypt" || n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P)) {
    return false;
  }

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) return false;

  const actual = scryptSync(password, salt, HASH_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return timingSafeEqual(actual, expected);
}
