import assert from "node:assert/strict";
import test from "node:test";
import { SINGAPORE_TEAM, assigneeInitials, assigneeLabel, teamMemberFor } from "./team.ts";

test("the team is the three placeholder people", () => {
  assert.deepEqual(
    SINGAPORE_TEAM.map((member) => [member.name, member.initials, member.email]),
    [
      ["Member 1", "M1", "member1@example.com"],
      ["Member 2", "M2", "member2@example.com"],
      ["Member 3", "M3", "member3@example.com"],
    ],
  );
  const colors = new Set(SINGAPORE_TEAM.map((member) => member.color));
  assert.equal(colors.size, SINGAPORE_TEAM.length);
});

test("owner text matches a team member by name, email, initials, or unique first name", () => {
  assert.equal(teamMemberFor("Member 3")?.email, "member3@example.com");
  assert.equal(teamMemberFor("  member 1 ")?.initials, "M1");
  assert.equal(teamMemberFor("member2@example.com")?.name, "Member 2");
  assert.equal(teamMemberFor("M3")?.name, "Member 3");
  assert.equal(teamMemberFor("Member")?.name, undefined);
  assert.equal(teamMemberFor("A&G"), null);
  assert.equal(teamMemberFor(null), null);
  assert.equal(teamMemberFor("  "), null);
});

test("assignee labels and initials fall back for people outside the team", () => {
  assert.equal(assigneeLabel("m3"), "Member 3");
  assert.equal(assigneeLabel("A&G"), "A&G");
  assert.equal(assigneeLabel(null), null);
  assert.equal(assigneeInitials("Member 3"), "M3");
  assert.equal(assigneeInitials("A&G"), "AG");
  assert.equal(assigneeInitials(""), "?");
});
