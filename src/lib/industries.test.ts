import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { INDUSTRIES, matchIndustry } from "./industries.ts";

const migration = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations/20261007130000_deal_industry_column.sql"),
  "utf8",
);

test("the industry list is the fixed EnterpriseSG set plus the four extras", () => {
  assert.equal(INDUSTRIES.length, 22);
  assert.equal(new Set(INDUSTRIES).size, 22);
  assert.equal(matchIndustry("  ict & media "), "ICT & Media");
  assert.equal(matchIndustry("Widgets"), null);
  assert.equal(matchIndustry("  "), null);
});

test("the migration check constraint carries every industry", () => {
  for (const industry of INDUSTRIES) {
    assert.match(migration, new RegExp(industry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(migration, /deals_industry_check/);
  assert.doesNotMatch(migration, /SET sector/i);
});
