# Update CRM from new information

Apply an email, call note, or document update to the matching deals, writing only what changed.

MCP prompt name: `update_deal_from_new_info`. The text below is the prompt the server returns; keep it in sync with `src/lib/mcp/prompts.ts`.

```text
Workflow: update the CRM from new information.

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
5. Reply with a short change log per deal: what changed, old value to new value, and the audit_id for each write. Point out anything that conflicts with what was stored instead of silently choosing.
```
