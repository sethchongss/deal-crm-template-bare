import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, CRM_PROMPTS } from "@/lib/mcp/prompts";
import { CRM_TOOL_NAMES } from "@/lib/mcp/tools";

test("prompts only reference tools the server exposes", () => {
  const known = new Set<string>(CRM_TOOL_NAMES);
  for (const prompt of Object.values(CRM_PROMPTS)) {
    for (const match of prompt.text.matchAll(/\b([a-z]+(?:_[a-z]+)+)\b/g)) {
      const word = match[1];
      if (/^(search|get|create|update|add|list|complete|link|unlink|undo)_/.test(word) && !word.startsWith("update_deal_from")) {
        assert.ok(known.has(word), `unknown tool ${word}`);
      }
    }
  }
});

test("buildPrompt appends material when given", () => {
  const empty = buildPrompt("new_deal_from_teaser");
  assert.equal(empty.messages[0].content.text, CRM_PROMPTS.new_deal_from_teaser.text);
  const filled = buildPrompt("update_deal_from_new_info", "  Company A signed the SPA.  ");
  assert.match(filled.messages[0].content.text, /Material:\nCompany A signed the SPA\.$/);
});
