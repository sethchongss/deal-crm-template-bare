const LOCAL_ORIGIN = "http://localhost:3000";

function bareHost(value: string) {
  return value.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

/**
 * Public hosts for this deploy: APP_PUBLIC_HOSTS (comma-separated host names, the first is the
 * canonical one), then the deploy's own hosts from Vercel's system variables when present
 * (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_BRANCH_URL, VERCEL_URL).
 */
export function configuredPublicHosts(): string[] {
  const list = (process.env.APP_PUBLIC_HOSTS ?? "").split(",");
  for (const name of ["VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_BRANCH_URL", "VERCEL_URL"]) {
    const value = process.env[name];
    if (value) list.push(value);
  }
  return [...new Set(list.map(bareHost).filter(Boolean))];
}

/** Origin used when the request host is not recognised: the first configured host, else localhost. */
export function fallbackOrigin() {
  const first = configuredPublicHosts()[0];
  return first ? `https://${first}` : LOCAL_ORIGIN;
}

export function isAllowedPublicHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  if (host === "localhost" || host === "127.0.0.1") return true;
  const configured = configuredPublicHosts();
  if (configured.includes(host)) return true;
  if (!host.endsWith(".vercel.app")) return false;
  const label = host.slice(0, -".vercel.app".length);
  // Preview deployments of a configured *.vercel.app project, e.g. my-crm-git-branch.vercel.app.
  return configured
    .filter((value) => value.endsWith(".vercel.app"))
    .map((value) => value.slice(0, -".vercel.app".length))
    .some((project) => label.startsWith(`${project}-`));
}

function firstHeader(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

/**
 * Public origin for OAuth and MCP metadata.
 * Reflects the request host when it is one of the known deployments (or local/preview).
 * An unrecognized Host is not echoed back.
 */
export function publicOrigin(request: Request) {
  const forwardedHost = firstHeader(request.headers.get("x-forwarded-host"));
  const hostHeader = forwardedHost || firstHeader(request.headers.get("host"));
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return fallbackOrigin();
  }
  const host = hostHeader || url.host;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if (!isAllowedPublicHost(hostname)) return fallbackOrigin();

  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const proto = local
    ? firstHeader(request.headers.get("x-forwarded-proto")) || url.protocol.replace(":", "") || "http"
    : "https";
  const port = local && host.includes(":") ? host.slice(host.indexOf(":")) : "";
  return `${proto}://${hostname}${port}`;
}

export function resourceUrl(origin: string) {
  return `${origin}/api/mcp`;
}

export function isAllowedResource(value: string) {
  try {
    const url = new URL(value);
    if (url.pathname !== "/api/mcp" || url.search || url.hash || url.username) return false;
    if (!isAllowedPublicHost(url.hostname)) return false;
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!local && url.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}
