const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const failures = new Map<string, number[]>();

function recent(ip: string, now: number) {
  const kept = (failures.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  if (kept.length === 0) failures.delete(ip);
  else failures.set(ip, kept);
  return kept;
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function isLoginLimited(ip: string, now = Date.now(), bucket = "web") {
  return recent(`${bucket}:${ip}`, now).length >= MAX_FAILURES;
}

export function recordLoginFailure(ip: string, now = Date.now(), bucket = "web") {
  const key = `${bucket}:${ip}`;
  const kept = recent(key, now);
  kept.push(now);
  failures.set(key, kept);
}
