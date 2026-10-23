import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export const NEW_DEAL_FROM_TEASER = `Workflow: new deal from teaser.

1. Read the whole teaser, IM or CIM, including charts and tables. Use only figures the document supports. Write "-" for anything undisclosed. Never estimate. Label management or unaudited figures as such.
2. Check for duplicates first: call search_deals with the company name, the project codename, and any obvious variants. If a match exists, do not create a new deal. Switch to the update workflow and log the teaser as a note on the existing deal.
3. Call create_deal with:
   - name: the project codename from the teaser, else the company name.
   - industry: exactly one allowed industry. sector: freeform sub-sector.
   - country, description (one or two plain sentences on what the business does), source (the sending adviser or channel, as written in the document).
   - currency, financial year, revenue, EBITDA, net debt, enterprise value, ownership, transaction type, stake and ticket size when stated. Keep currency and scale, for example "USD 12.4M".
   - other_info: anything material that does not fit a field (segment mix, growth path, process timetable).
   Leave board and stage at their defaults (Pipeline, Screening/Pipeline) unless the user says otherwise.
4. Call add_deal_note with a short intake note: date received, what was received, headline figures, process deadline if any.
5. If the teaser gives a process timetable, call add_workstream ("Process") and add_task for each dated step (for example "Indicative offer due"), with end_date set.
6. Reply with the deal name, the fields filled, the fields left blank, and the audit_id so the change can be undone.`;

export const UPDATE_DEAL_FROM_NEW_INFO = `Workflow: update the CRM from new information.

Use this whenever new information arrives about a deal: an email, call notes, meeting notes, a revised teaser, financials, or a process letter.

1. Identify every deal the information touches. Call search_deals for each company or codename mentioned, then get_deal to load current state. If no deal matches and the information is a new opportunity, use the new deal from teaser workflow instead. If the match is ambiguous, ask before writing.
2. Compare the new information with the stored deal. Only write what changed or is new. Do not overwrite a stored figure with a less precise one.
3. Write the changes:
   - Status or next-step change: add_deal_note with a one or two sentence summary, dated. This also sets the latest update.
   - Field changes (financials, valuation, stage, dates such as target completion or exclusivity end): update_deal with only the changed fields.
   - Deal passed: update_deal with is_passed true and passed_reason. Do not archive unless asked.
   - Tasks: complete_task for steps that are done, add_task for new dated steps, update_task for moved dates or new owners.
   - People: list_partners to find an existing adviser or contact, create_partner only if missing, then link_partner_to_deal with their role.
4. Never delete. Never change a deal you were not asked about.
5. Reply with a short change log per deal: what changed, old value to new value, and the audit_id for each write. Point out anything that conflicts with what was stored instead of silently choosing.`;

export const PRELIMINARY_SCREEN = `Workflow: preliminary screen of a new teaser.

Give a short verdict block per deal: "<Project name>: pass" or "<Project name>: worth a first call".
- What it is: business, country, headcount, ownership.
- Trend: revenue path by year.
- Margins: gross and EBITDA margin.
- Revenue mix: segments as % of revenue, recurring share.
- Key risks: structural, customer or supplier concentration, key people, separation from a parent.
- Why interesting (if worth a call): defensibility, growth angles, buy-and-build potential.
- What the teaser does not tell us: the questions for a first call.
Rules: use only teaser figures, write "-" where undisclosed, never estimate, cite a source for any external fact. Keep it tight. After the screen, offer to file it with the new deal from teaser workflow and store the verdict in other_info or a note.`;

export const CRM_PROMPTS = {
  new_deal_from_teaser: {
    title: "New deal from teaser",
    description: "Create a screened deal from a teaser, IM or CIM, after checking for duplicates.",
    text: NEW_DEAL_FROM_TEASER,
  },
  update_deal_from_new_info: {
    title: "Update CRM from new information",
    description: "Apply an email, call note, or document update to the matching deals, writing only what changed.",
    text: UPDATE_DEAL_FROM_NEW_INFO,
  },
  preliminary_screen: {
    title: "Preliminary screen",
    description: "Quick pass or worth-a-first-call view on a teaser before filing it.",
    text: PRELIMINARY_SCREEN,
  },
} as const;

export type CrmPromptName = keyof typeof CRM_PROMPTS;

export function buildPrompt(name: CrmPromptName, material?: string) {
  const base = CRM_PROMPTS[name].text;
  const body = material?.trim() ? `${base}\n\nMaterial:\n${material.trim()}` : base;
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text: body } }] };
}

export function registerCrmPrompts(server: McpServer) {
  for (const name of Object.keys(CRM_PROMPTS) as CrmPromptName[]) {
    const prompt = CRM_PROMPTS[name];
    server.registerPrompt(
      name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: z.object({ material: z.string().optional().describe("Pasted teaser, email, or notes.") }),
      },
      async ({ material }) => buildPrompt(name, material),
    );
  }
}
