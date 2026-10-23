const WINDOW_MS = 60 * 1000;
const MAX_CALLS = 120;
const hits = new Map<string, number[]>();

function recent(key: string, now: number) {
  const kept = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (kept.length === 0) hits.delete(key);
  else hits.set(key, kept);
  return kept;
}

export function consumeMcpCall(key: string, now = Date.now()) {
  const kept = recent(key, now);
  if (kept.length >= MAX_CALLS) return false;
  kept.push(now);
  hits.set(key, kept);
  return true;
}

export function resetMcpLimits() {
  hits.clear();
}
