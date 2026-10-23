import { randomBytes, scryptSync } from "node:crypto";

const password = process.env.TEAM_PASSWORD;
if (!password) {
  console.error("Set TEAM_PASSWORD to the password you want to hash. This script does not write it anywhere.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
process.stdout.write(`scrypt:16384:8:1:${salt.toString("base64")}:${hash.toString("base64")}\n`);
