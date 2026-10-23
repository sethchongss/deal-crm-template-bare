import { TEAM_MEMBERS } from "@/lib/mcp/team";
import { APP_NAME } from "@/lib/brand";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function consentErrorHtml(message: string) {
  return `<!doctype html><html lang="en"><body style="font:15px ui-sans-serif,system-ui;background:#f6f5f2;color:#1c1917;display:grid;place-items:center;min-height:100vh"><main style="max-width:28rem;padding:2rem"><h1 style="font-size:1.3rem">Couldn't start the connection</h1><p>${esc(message)}</p></main></body></html>`;
}

export function consentHtml(input: { txn: string; clientName: string; error?: string }) {
  const options = TEAM_MEMBERS.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
  const error = input.error ? `<p class="error" role="alert">${esc(input.error)}</p>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect Claude · ${esc(APP_NAME)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f5f2; color: #1c1917; font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; }
    main { width: min(100%, 28rem); padding: 2rem 1.25rem; }
    h1 { font-size: 1.45rem; letter-spacing: -0.03em; margin: 0 0 0.35rem; }
    p { margin: 0; color: #57534e; }
    form { margin-top: 1.5rem; display: grid; gap: 0.9rem; }
    label { display: grid; gap: 0.35rem; font-size: 0.85rem; font-weight: 600; }
    input, select { height: 2.4rem; border: 1px solid #d6d3d1; border-radius: 0.6rem; padding: 0 0.7rem; font: inherit; background: white; }
    button { height: 2.5rem; border: 0; border-radius: 999px; background: #1c1917; color: #fafaf9; font: inherit; font-weight: 600; cursor: pointer; }
    .error { color: #3f3f46; font-size: 0.9rem; }
    .hint { font-weight: 400; color: #78716c; }
  </style>
</head>
<body>
  <main>
    <p>${esc(APP_NAME)}</p>
    <h1>Connect Claude to the deal CRM</h1>
    <p>${esc(input.clientName)} is asking to read and update deals. Enter the shared team password. Your name is optional and is stored on changes Claude makes, so they can be undone.</p>
    <form method="post" action="/api/oauth/authorize">
      <input type="hidden" name="txn" value="${esc(input.txn)}" />
      <label>Team password
        <input name="password" type="password" autocomplete="current-password" required autofocus />
      </label>
      <label>Your name <span class="hint">(optional)</span>
        <select name="actor">
          <option value="">Not specified</option>
          ${options}
        </select>
      </label>
      ${error}
      <button type="submit">Allow Claude</button>
    </form>
  </main>
</body>
</html>`;
}
