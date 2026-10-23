# New deal from teaser

Create a screened deal from a teaser, IM or CIM, after checking for duplicates.

MCP prompt name: `new_deal_from_teaser`. The text below is the prompt the server returns; keep it in sync with `src/lib/mcp/prompts.ts`.

```text
Workflow: new deal from teaser.

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
6. Reply with the deal name, the fields filled, the fields left blank, and the audit_id so the change can be undone.
```
