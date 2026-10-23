# Deal workflows

Three reusable workflows for running the CRM through the MCP connector. Each is exposed by the MCP server as a prompt (`prompts/list`, `prompts/get`) and documented here so it can also be pasted into a project instruction or a client-side skill.

| Workflow | MCP prompt | Tools used |
| --- | --- | --- |
| [New deal from teaser](new-deal-from-teaser.md) | `new_deal_from_teaser` | `search_deals`, `create_deal`, `add_deal_note`, `add_workstream`, `add_task` |
| [Update CRM from new information](update-crm-from-new-info.md) | `update_deal_from_new_info` | `search_deals`, `get_deal`, `update_deal`, `add_deal_note`, `add_task`, `update_task`, `complete_task`, `list_partners`, `create_partner`, `link_partner_to_deal` |
| [Preliminary screen](preliminary-screen.md) | `preliminary_screen` | none until filed |

## Setup

1. Deploy the app and connect the MCP server as described in [../claude-connector.md](../claude-connector.md). No extra environment variables or migrations are needed; the prompts ship with the server (`src/lib/mcp/prompts.ts`, registered in `src/lib/mcp/http.ts`).
2. In an MCP client that supports prompts, pick the prompt from the prompt menu and paste the teaser, email, or notes into the `material` argument.
3. In a client without prompt support, copy the text block from the workflow file into the project or custom instructions.
4. To make the update workflow run automatically, point whatever process receives new deal information (a shared inbox rule, a forwarding address, a scheduled job) at a client session that runs `update_deal_from_new_info` with the message body as `material`. Every write is tagged in the audit log and can be reverted with `undo_change`.
5. Teasers can also be filed without the connector: the app's own upload flow (`/api/extract-deal`) extracts the same fields into the new-deal form for review.

## Customising

Edit the text in `src/lib/mcp/prompts.ts`, then update the matching file in this folder. `npm test` checks that every tool a prompt mentions exists on the server.

## Examples

- "Use new_deal_from_teaser on this teaser for Company A."
- "Use update_deal_from_new_info: Member 1 says the indicative offer deadline for Company B moved to next Friday."
