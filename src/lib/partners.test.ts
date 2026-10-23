import assert from "node:assert/strict";
import test from "node:test";
import { avatarTone, partnerChips, partnerInitials, uniqueDealRoles } from "./partners.ts";

test("a name always gets the same soft avatar colour", () => {
  assert.equal(avatarTone("Firm C"), avatarTone("Firm C"));
  assert.notEqual(avatarTone("Firm C"), avatarTone(""));
  assert.equal(avatarTone("   "), avatarTone(""));
  const allowed = new Set(["blue", "purple", "green", "moss", "amber", "teal", "yellow"]);
  for (const name of ["Firm C", "Firm A", "North & South", "?"]) {
    assert.equal(allowed.has(avatarTone(name)), true);
  }
});

test("initials skip punctuation-only words", () => {
  assert.equal(partnerInitials("North & South"), "NS");
  assert.equal(partnerInitials("Firm B"), "FB");
  assert.equal(partnerInitials("  "), "?");
});

test("deal chips keep type and firm, and drop a firm that repeats the type", () => {
  assert.deepEqual(
    partnerChips({ type: "advisors", company: "Firm C & Co", roles: ["advisor"], includeRoles: false }).map((chip) => chip.label),
    ["Advisor", "Firm C & Co"],
  );
  assert.deepEqual(
    partnerChips({ type: "advisors", company: " advisor ", includeRoles: false }).map((chip) => [chip.kind, chip.label]),
    [["type", "Advisor"]],
  );
});

test("partner chips keep a role only when its text is new", () => {
  assert.deepEqual(
    partnerChips({ type: "lawyers", company: "North & South LLC", roles: ["source"], includeRoles: true }).map((chip) => chip.label),
    ["Lawyer", "Introducer / source", "North & South LLC"],
  );
  assert.deepEqual(
    partnerChips({ type: "co-investors", company: "Co-investor", roles: ["co-investor", "advisor"], includeRoles: true }).map((chip) => chip.label),
    ["Co-investor", "Advisor"],
  );
});

test("a lender chip is distinct from a banker chip", () => {
  const lender = partnerChips({ type: "lenders", company: "DBS", includeRoles: false });
  const banker = partnerChips({ type: "bankers", company: "DBS", includeRoles: false });
  assert.equal(lender[0]?.label, "Lender");
  assert.equal(lender[0]?.tone, "orange");
  assert.equal(banker[0]?.tone, "amber");
  assert.notEqual(lender[0]?.tone, banker[0]?.tone);
});

test("shared deal-role labels are tagged once", () => {
  assert.deepEqual(uniqueDealRoles(["source", "introducer", "advisor"]), ["source", "advisor"]);
  assert.deepEqual(uniqueDealRoles([]), []);
});
