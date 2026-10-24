import assert from "node:assert/strict";
import test from "node:test";
import { CrmError, buildCreateDeal, buildUpdateDeal, parseBoard } from "@/lib/mcp/deal-write";
import { MemoryStore } from "@/lib/mcp/memory-store";
import { CRM_TOOL_NAMES, callCrmTool } from "@/lib/mcp/tools";
import type { Deal } from "@/types/database";

const current = {
  tier: "pipeline",
  passed_at: null,
  deal_stage: "Screening/Pipeline",
  latest_sales: null,
  latest_ebitda: null,
  net_debt_cash: null,
  sector: null,
  country: null,
} as Pick<Deal, "tier" | "passed_at" | "deal_stage" | "latest_sales" | "latest_ebitda" | "net_debt_cash" | "sector" | "country">;

test("create writes text financials and the derived numeric columns", () => {
  const row = buildCreateDeal(
    {
      name: "deal-1",
      company: "Company A Pte Ltd",
      sector: "Healthcare",
      country: "Singapore",
      revenue: 12,
      ebitda: "S$3.5M",
      net_debt: 1,
      currency: "SGD",
      enterprise_value: "S$40M",
    },
    0,
  );
  assert.equal(row.company_name, "deal-1");
  assert.equal(row.legal_name, "Company A Pte Ltd");
  assert.equal(row.tier, "pipeline");
  assert.equal(row.deal_stage, "Screening/Pipeline");
  assert.equal(row.is_passed, false);
  assert.equal(row.latest_sales, "S$ 12M");
  assert.equal(row.sales_amount, 12);
  assert.equal(row.latest_ebitda, "S$3.5M");
  assert.equal(row.ebitda_amount, 3.5);
  assert.equal(row.net_debt_amount, 1);
  assert.equal(row.fin_currency, "SGD");
  assert.equal(row.sector_group, "Healthcare");
  assert.throws(() => buildCreateDeal({ name: "Bad", industry: "Widgets" }, 0), /Industry must be one of/);
  const tagged = buildCreateDeal({ name: "Tagged", industry: "ict & media", sector: "Technology" }, 0);
  assert.equal(tagged.industry, "ICT & Media");
  assert.equal(tagged.sector, "Technology");
  assert.equal(tagged.sector_group, "Technology");
  assert.deepEqual(row.countries, ["Singapore"]);
});

test("a new deal and a board move take the top sort_order", async () => {
  const store = new MemoryStore();
  const first = (await callCrmTool(store, "create_deal", { name: "First" })) as { deal: { id: string; sort_order: number } };
  const second = (await callCrmTool(store, "create_deal", { name: "Second" })) as { deal: { id: string; sort_order: number } };
  assert.equal(first.deal.sort_order, 0);
  assert.equal(second.deal.sort_order, -1);

  await callCrmTool(store, "update_deal", { deal_id: first.deal.id, board: "Active" });
  const moved = (await callCrmTool(store, "get_deal", { deal_id: first.deal.id })) as { deal: { tier: string; sort_order: number } };
  assert.equal(moved.deal.tier, "active");
  assert.equal(moved.deal.sort_order, 0);

  const third = (await callCrmTool(store, "create_deal", { name: "Third", board: "Active" })) as { deal: { sort_order: number } };
  assert.equal(third.deal.sort_order, -1);

  const passed = (await callCrmTool(store, "update_deal", { deal_id: second.deal.id, is_passed: true })) as {
    deal: { tier: string; sort_order: number };
  };
  assert.equal(passed.deal.tier, "passed");
  assert.equal(passed.deal.sort_order, 0);
});

test("passing keeps the stage and un-passing restores an active board", () => {
  const passed = buildUpdateDeal(current, { is_passed: true, passed_reason: "valuation gap" }, null);
  assert.equal(passed.tier, "passed");
  assert.equal(passed.is_passed, true);
  assert.equal(passed.deal_stage, undefined);
  assert.equal(passed.passed_reason, "valuation gap");

  const onPassed = { ...current, tier: "passed" as const, passed_at: "2026-01-01T00:00:00.000Z" };
  assert.equal(buildUpdateDeal(onPassed, { is_passed: false }, "active").tier, "active");
  assert.equal(buildUpdateDeal(onPassed, { is_passed: false }, null).tier, "pipeline");
  assert.equal(buildUpdateDeal(onPassed, { is_passed: false }, null).is_passed, false);

  assert.throws(() => buildUpdateDeal(current, { is_passed: true, board: "pipeline" }, null), CrmError);
  assert.throws(() => buildUpdateDeal(onPassed, { is_passed: false, board: "passed" }, null), /active board/);
  assert.throws(() => buildCreateDeal({ name: "X", stage: "Passed" }, 0), /retired/);
});

test("tools create, update, and undo against the memory store", async () => {
  assert.equal(CRM_TOOL_NAMES.length, 17);
  assert.equal(CRM_TOOL_NAMES.includes("delete_deal"), false);

  const store = new MemoryStore();
  store.actor = "Member 1";
  const created = (await callCrmTool(store, "create_deal", {
    name: "deal-2",
    company: "Company E Ltd",
    sector: "Healthcare",
    revenue: 8,
    currency: "SGD",
  })) as { audit_id: string; deal: { id: string; company_name: string; tier: string; sales_amount: number } };
  assert.equal(created.deal.company_name, "deal-2");
  assert.equal(created.deal.tier, "pipeline");
  assert.equal(created.deal.sales_amount, 8);

  const loaded = (await callCrmTool(store, "get_deal", { deal: "deal-2" })) as { deal: { id: string } };
  assert.equal(loaded.deal.id, created.deal.id);

  await callCrmTool(store, "update_deal", { deal_id: created.deal.id, board: "Active" });
  const passed = (await callCrmTool(store, "update_deal", {
    deal_id: created.deal.id,
    is_passed: true,
    passed_reason: "valuation gap",
  })) as { audit_id: string; deal: { tier: string; deal_stage: string; is_passed: boolean } };
  assert.equal(passed.deal.tier, "passed");
  assert.equal(passed.deal.is_passed, true);
  assert.equal(passed.deal.deal_stage, "Screening/Pipeline");

  const found = (await callCrmTool(store, "search_deals", { board: "Passed / Out", is_passed: true })) as { count: number };
  assert.equal(found.count, 1);

  const restored = (await callCrmTool(store, "update_deal", { deal_id: created.deal.id, is_passed: false })) as {
    deal: { tier: string; is_passed: boolean; deal_stage: string };
  };
  assert.equal(restored.deal.tier, "active");
  assert.equal(restored.deal.is_passed, false);
  assert.equal(restored.deal.deal_stage, "Screening/Pipeline");

  const renamed = (await callCrmTool(store, "update_deal", { deal_id: created.deal.id, name: "deal-2 II" })) as {
    audit_id: string;
    deal: { company_name: string };
  };
  await callCrmTool(store, "undo_change", { audit_id: renamed.audit_id });
  const afterUndo = (await callCrmTool(store, "get_deal", { deal_id: created.deal.id })) as { deal: { company_name: string } };
  assert.equal(afterUndo.deal.company_name, "deal-2");

  const noted = (await callCrmTool(store, "add_deal_note", { deal: "deal-2", note: "Teaser received" })) as {
    audit_id: string;
  };
  const withNote = (await callCrmTool(store, "get_deal", { deal: "deal-2" })) as {
    notes: { content: string }[];
    deal: { latest_update: string };
  };
  assert.equal(withNote.notes[0]?.content, "Teaser received");
  assert.equal(withNote.deal.latest_update, "Teaser received");

  const stream = (await callCrmTool(store, "add_workstream", { deal: "deal-2", name: "Legal" })) as {
    workstream: { id: string };
  };
  const task = (await callCrmTool(store, "add_task", {
    deal: "deal-2",
    workstream: "Legal",
    title: "SPA",
    owner: "Member 1",
    start_date: "2026-10-01",
    end_date: "2026-10-03",
  })) as { task: { id: string; status: string } };
  const done = (await callCrmTool(store, "complete_task", { task_id: task.task.id, comment: "SPA signed today" })) as {
    task: { status: string; comment: string };
  };
  assert.equal(done.task.status, "done");
  assert.equal(done.task.comment, "SPA signed today");
  assert.equal(stream.workstream.id.length > 0, true);

  const partner = (await callCrmTool(store, "create_partner", { name: "Firm B", role: "advisor" })) as {
    partner: { id: string };
  };
  await callCrmTool(store, "link_partner_to_deal", { deal: "deal-2", partner_id: partner.partner.id, role: "advisor" });
  const linked = (await callCrmTool(store, "get_deal", { deal: "deal-2" })) as { partners: { partner_id: string }[] };
  assert.equal(linked.partners.some((item) => item.partner_id === partner.partner.id), true);
  await callCrmTool(store, "unlink_partner_from_deal", { deal: "deal-2", partner_id: partner.partner.id });

  const recent = (await callCrmTool(store, "list_recent_changes", { claude_only: true })) as {
    tagging_installed: boolean;
    changes: { actor: string | null; source: string | null }[];
  };
  assert.equal(recent.tagging_installed, true);
  assert.equal(recent.changes[0]?.actor, "Member 1");
  assert.equal(recent.changes[0]?.source, "claude");

  await callCrmTool(store, "undo_change", { audit_id: noted.audit_id });
  await callCrmTool(store, "undo_change", { audit_id: created.audit_id });
  await assert.rejects(() => callCrmTool(store, "get_deal", { deal_id: created.deal.id }), /No deal/);
});

test("update_deal latest_update is logged as a note and does not clear on blank text", async () => {
  const store = new MemoryStore();
  const created = (await callCrmTool(store, "create_deal", { name: "Notes Co" })) as { deal: { id: string } };
  const updated = (await callCrmTool(store, "update_deal", {
    deal_id: created.deal.id,
    latest_update: "SPA signed",
  })) as { deal: { latest_update: string }; note_audit_id: string };
  assert.equal(updated.deal.latest_update, "SPA signed");
  assert.equal(typeof updated.note_audit_id, "string");

  const loaded = (await callCrmTool(store, "get_deal", { deal_id: created.deal.id })) as {
    notes: { content: string }[];
    deal: { latest_update: string; company_name: string };
  };
  assert.equal(loaded.notes[0]?.content, "SPA signed");

  await callCrmTool(store, "update_deal", { deal_id: created.deal.id, name: "Notes Co II" });
  const renamed = (await callCrmTool(store, "get_deal", { deal_id: created.deal.id })) as {
    notes: { content: string }[];
    deal: { company_name: string; latest_update: string };
  };
  assert.equal(renamed.deal.company_name, "Notes Co II");
  assert.equal(renamed.deal.latest_update, "SPA signed");
  assert.equal(renamed.notes.length, 1);

  await assert.rejects(
    () => callCrmTool(store, "update_deal", { deal_id: created.deal.id, latest_update: "   " }),
    /can't be empty/,
  );
  const still = (await callCrmTool(store, "get_deal", { deal_id: created.deal.id })) as {
    notes: { content: string }[];
    deal: { latest_update: string };
  };
  assert.equal(still.deal.latest_update, "SPA signed");
  assert.equal(still.notes.length, 1);
});

test("create_partner accepts lender and list_partners can filter to it", async () => {
  const store = new MemoryStore();
  const created = (await callCrmTool(store, "create_partner", { name: "DBS Lending", role: "Lender" })) as {
    partner: { role: string };
  };
  assert.equal(created.partner.role, "lenders");
  await callCrmTool(store, "create_partner", { name: "Firm B", role: "advisor" });
  const listed = (await callCrmTool(store, "list_partners", { role: "lenders" })) as {
    count: number;
    partners: { name: string; role: string }[];
  };
  assert.equal(listed.count, 1);
  assert.equal(listed.partners[0]?.name, "DBS Lending");
  assert.equal(listed.partners[0]?.role, "lenders");
  await assert.rejects(() => callCrmTool(store, "create_partner", { name: "Nope", role: "broker" }), /lenders/);
});

test("undo refuses a change that was not made via Claude", async () => {
  const store = new MemoryStore();
  store.source = "web";
  const created = await store.createDeal({ company_name: "Web Deal", tier: "pipeline", deal_stage: "Screening/Pipeline" });
  store.source = "claude";
  await assert.rejects(() => store.undo(created.audit_id), /only changes made via Claude/);
});

test("there are three boards and the old active board names map to Active", () => {
  assert.equal(parseBoard("Active"), "active");
  assert.equal(parseBoard("Active Tier I"), "active");
  assert.equal(parseBoard("active_tier_2"), "active");
  assert.equal(parseBoard("Pipeline"), "pipeline");
  assert.equal(parseBoard("Passed / Out"), "passed");
  assert.throws(() => parseBoard("Tier III"), CrmError);
});
