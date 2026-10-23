import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SECTOR_GROUPS, SECTOR_MAP, normalizeCountries, normalizeSector } from "./taxonomy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(readFileSync(join(here, "fixtures/sample-profile.json"), "utf8")) as {
  sector: [string, number][];
  country: [string, number][];
};
const migration = readFileSync(
  join(here, "../../supabase/migrations/20261003130200_sector_country.sql"),
  "utf8",
);

test("sector groups stay inside the requested range", () => {
  assert.ok(SECTOR_GROUPS.length >= 15 && SECTOR_GROUPS.length <= 20, SECTOR_GROUPS.join(", "));
});

test("every sample sector is mapped", () => {
  const missing = profile.sector
    .map(([value]) => value)
    .filter((value) => !SECTOR_MAP[value]);
  assert.deepEqual(missing, []);
});

test("SQL lookup matches the TypeScript map", () => {
  const rows = [...migration.matchAll(/\('((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g)].map((match) => ({
    source: match[1].replaceAll("''", "'"),
    group: match[2].replaceAll("''", "'"),
    detail: match[3].replaceAll("''", "'"),
  }));
  const fromSql = new Map(rows.map((row) => [row.source, row]));
  assert.equal(fromSql.size, Object.keys(SECTOR_MAP).length);
  for (const [source, mapped] of Object.entries(SECTOR_MAP)) {
    const row = fromSql.get(source);
    assert.ok(row, source);
    assert.equal(row.group, mapped.sector_group);
    assert.equal(row.detail, mapped.sector_detail);
    assert.deepEqual(normalizeSector(source), {
      sector_group: mapped.sector_group,
      sector_detail: mapped.sector_detail,
    });
  }
});

test("country strings split on slash and blank becomes null", () => {
  const seen = new Set<string>();
  for (const [value] of profile.country) {
    seen.add(value);
    if (value.trim() === "") {
      assert.equal(normalizeCountries(value), null);
    } else if (value.includes("/")) {
      assert.deepEqual(normalizeCountries(value), ["Malaysia", "Indonesia"]);
    } else {
      assert.deepEqual(normalizeCountries(value), [value]);
    }
  }
  assert.equal(normalizeCountries(null), null);
  assert.equal(normalizeCountries("   "), null);
  assert.ok(seen.has(""));
  assert.ok(seen.has("Malaysia / Indonesia"));
});
