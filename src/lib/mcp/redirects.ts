const CLAUDE_CALLBACKS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopback(url: URL) {
  return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
}

/** Port-agnostic loopback match, per RFC 8252 §7.3 and Claude Code's localhost callback. */
export function redirectMatches(requested: string, registered: string) {
  const left = parseHttpUrl(requested);
  const right = parseHttpUrl(registered);
  if (!left || !right) return false;
  if (isLoopback(left) && isLoopback(right)) {
    return (
      left.protocol === right.protocol &&
      left.hostname === right.hostname &&
      left.pathname === right.pathname &&
      left.search === right.search
    );
  }
  return left.href === right.href;
}

/** Redirects we are willing to send a code to, before client registration is considered. */
export function redirectAllowed(uri: string) {
  const url = parseHttpUrl(uri);
  if (!url) return false;
  if (CLAUDE_CALLBACKS.has(url.href)) return true;
  if (!isLoopback(url) || url.protocol !== "http:") return false;
  return url.pathname === "/callback" && url.search === "";
}

export function clientRedirectAllowed(uri: string, registered: readonly string[]) {
  if (!redirectAllowed(uri)) return false;
  return registered.some((item) => redirectMatches(uri, item));
}
