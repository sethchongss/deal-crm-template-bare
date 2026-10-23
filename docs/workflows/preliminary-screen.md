# Preliminary screen

Quick pass or worth-a-first-call view on a teaser before filing it.

MCP prompt name: `preliminary_screen`. The text below is the prompt the server returns; keep it in sync with `src/lib/mcp/prompts.ts`.

```text
Workflow: preliminary screen of a new teaser.

Give a short verdict block per deal: "<Project name>: pass" or "<Project name>: worth a first call".
- What it is: business, country, headcount, ownership.
- Trend: revenue path by year.
- Margins: gross and EBITDA margin.
- Revenue mix: segments as % of revenue, recurring share.
- Key risks: structural, customer or supplier concentration, key people, separation from a parent.
- Why interesting (if worth a call): defensibility, growth angles, buy-and-build potential.
- What the teaser does not tell us: the questions for a first call.
Rules: use only teaser figures, write "-" where undisclosed, never estimate, cite a source for any external fact. Keep it tight. After the screen, offer to file it with the new deal from teaser workflow and store the verdict in other_info or a note.
```
