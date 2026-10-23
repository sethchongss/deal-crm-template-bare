"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { CardValuation } from "@/components/card-valuation";
import { LoggedAge } from "@/components/logged-age";
import { Tag } from "@/components/tag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ViaClaude } from "@/components/via-claude";
import { useCrm } from "@/components/crm-provider";
import { cardSummary } from "@/lib/card-summary";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/constants";
import { PASSED_TONE, PROPRIETARY_TONE } from "@/lib/tag-styles";
import { CountryChip } from "@/components/country-chip";
import { IndustryChip } from "@/components/industry-chip";
import { initials } from "@/lib/format";
import { matchesProprietary, type ProprietaryFilterValue } from "@/lib/proprietary";
import { KANBAN_SCROLL_KEY, parseKanbanScroll, type KanbanScroll } from "@/lib/board-return";
import { orderBoardDeals, reindexAfterDrop } from "@/lib/kanban-order";
import { displayStage, passedAtLabel, stageTone } from "@/lib/passed";
import type { Deal, DealTier } from "@/types/database";
import { cn } from "@/lib/utils";

const HIDDEN_KEY = "kanban-hidden-columns";
const RAIL_KEY = "kanban-hidden-rail";

function rememberScroll(event: UIEvent<HTMLElement>) {
  const el = event.currentTarget;
  el.classList.add("is-scrolling");
  window.clearTimeout(Number(el.dataset.scrollTimer || 0));
  const timer = window.setTimeout(() => el.classList.remove("is-scrolling"), 700);
  el.dataset.scrollTimer = String(timer);
}

interface KanbanBoardProps {
  deals: Deal[];
  onSelectDeal: (deal: Deal) => void;
  onAddDeal: (tier: DealTier) => void;
  searchQuery: string;
  sectorFilter: string;
  countryFilter: string;
  proprietaryFilter: ProprietaryFilterValue;
}

export function KanbanBoard({ deals, onSelectDeal, onAddDeal, searchQuery, sectorFilter, countryFilter, proprietaryFilter }: KanbanBoardProps) {
  const { partners, links, claudeMarks, reorderDeals, notify } = useCrm();
  const [hidden, setHidden] = useState<DealTier[]>([]);
  const [railOpen, setRailOpen] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const restoredScroll = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(HIDDEN_KEY);
    const rail = window.localStorage.getItem(RAIL_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DealTier[];
        if (Array.isArray(parsed)) setHidden(parsed.filter((tier) => TIER_ORDER.includes(tier)));
      } catch {
        window.localStorage.removeItem(HIDDEN_KEY);
      }
    }
    setRailOpen(rail === "open");
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  }, [hidden, prefsReady]);

  useEffect(() => {
    if (!prefsReady) return;
    window.localStorage.setItem(RAIL_KEY, railOpen ? "open" : "closed");
  }, [railOpen, prefsReady]);

  const persistScroll = () => {
    const row = rowRef.current;
    const columns: Record<string, number> = {};
    row?.querySelectorAll<HTMLElement>("[data-board-scroll]").forEach((el) => {
      const tier = el.dataset.boardScroll;
      if (tier) columns[tier] = el.scrollTop;
    });
    const snapshot: KanbanScroll = { x: row?.scrollLeft ?? 0, columns };
    sessionStorage.setItem(KANBAN_SCROLL_KEY, JSON.stringify(snapshot));
  };

  useEffect(() => {
    if (restoredScroll.current) return;
    restoredScroll.current = true;
    const saved = parseKanbanScroll(sessionStorage.getItem(KANBAN_SCROLL_KEY));
    if (!saved) return;
    const apply = () => {
      const row = rowRef.current;
      if (!row) return;
      row.scrollLeft = saved.x;
      row.querySelectorAll<HTMLElement>("[data-board-scroll]").forEach((el) => {
        const tier = el.dataset.boardScroll;
        if (tier && saved.columns[tier] != null) el.scrollTop = saved.columns[tier];
      });
    };
    apply();
    const frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => persistScroll(), []);

  const isVisible = (deal: Deal) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = [deal.company_name, deal.industry, deal.sector, deal.sector_group, deal.country, deal.company_description, deal.latest_context]
        .some((field) => field?.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (sectorFilter && deal.industry !== sectorFilter) return false;
    if (countryFilter && deal.country !== countryFilter && !(deal.countries || []).includes(countryFilter)) return false;
    if (!matchesProprietary(deal.is_proprietary, proprietaryFilter)) return false;
    return true;
  };

  const columns = TIER_ORDER.map((tier) => {
    const inTier = orderBoardDeals(deals.filter((deal) => deal.tier === tier));
    return {
      tier,
      ...TIER_CONFIG[tier],
      deals: inTier.filter((deal) => isVisible(deal)),
      total: inTier.length,
    };
  });

  const visibleColumns = columns.filter((column) => !hidden.includes(column.tier));
  const hiddenColumns = columns.filter((column) => hidden.includes(column.tier));

  const partnersByDeal = useMemo(() => {
    const byId = new Map(partners.map((partner) => [partner.id, partner]));
    const map = new Map<string, { id: string; name: string }[]>();
    for (const link of links) {
      const partner = byId.get(link.partner_id);
      if (!partner) continue;
      const list = map.get(link.deal_id) ?? [];
      list.push({ id: partner.id, name: partner.name });
      map.set(link.deal_id, list);
    }
    return map;
  }, [links, partners]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.droppableId === result.source.droppableId && result.destination.index === result.source.index) return;
    const destinationTier = result.destination.droppableId as DealTier;
    const destination = columns.find((column) => column.tier === destinationTier);
    const updates = reindexAfterDrop({
      deals,
      draggedId: result.draggableId,
      destinationTier,
      destinationIndex: result.destination.index,
      isVisible: (id) => {
        const deal = deals.find((item) => item.id === id);
        return !!deal && isVisible(deal);
      },
    });
    const ok = await reorderDeals(updates);
    if (!ok) return;
    const deal = deals.find((item) => item.id === result.draggableId);
    if (deal && destination && deal.tier !== destinationTier) {
      notify(`${deal.company_name} moved to ${destination.label}`);
    } else if (deal) {
      notify(`${deal.company_name} reordered`);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <TooltipProvider delayDuration={400}>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 lg:flex-row">
        {hiddenColumns.length > 0 && (
          <div className="flex gap-2 overflow-x-auto lg:hidden">
            {hiddenColumns.map((column) => (
              <button
                key={column.tier}
                type="button"
                className="press shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs"
                onClick={() => setHidden((current) => current.filter((tier) => tier !== column.tier))}
              >
                Show {column.label}
                <span className="ml-1 tabular-nums text-muted-foreground">{column.total}</span>
              </button>
            ))}
          </div>
        )}
        <div ref={rowRef} className="sleek-scroll flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto pb-1" onScroll={(event) => { rememberScroll(event); persistScroll(); }}>
          {visibleColumns.map((column) => (
            <section key={column.tier} className="flex min-w-[240px] max-w-[36rem] flex-1 basis-0 flex-col md:min-w-[272px]">
              <header className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", column.dot)} />
                  <h2 className="text-[13px] font-semibold tracking-[-0.02em]">{column.label}</h2>
                  <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{column.deals.length}</span>
                </div>
                <div className="flex items-center">
                  <button type="button" className="press rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hoverable:hover:bg-accent" onClick={() => setHidden((current) => [...current, column.tier])}>
                    Hide
                  </button>
                  <button type="button" className="press grid size-7 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent" onClick={() => onAddDeal(column.tier)} aria-label={`Add deal to ${column.label}`}>
                    <Plus className="size-4" />
                  </button>
                </div>
              </header>
              <Droppable droppableId={column.tier}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    data-board-scroll={column.tier}
                    className={cn(
                      "sleek-scroll flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl p-2 transition-[background-color] duration-150 ease-power3-out",
                      snapshot.isDraggingOver ? "bg-muted" : "bg-secondary",
                    )}
                    onScroll={(event) => { rememberScroll(event); persistScroll(); }}
                  >
                    {column.deals.map((deal, index) => {
                      const people = partnersByDeal.get(deal.id) ?? [];
                      const claude = claudeMarks.find((mark) => mark.table_name === "deals" && mark.row_id === deal.id);
                      const summary = cardSummary(deal.company_description);
                      return (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={dragProvided.draggableProps.style}
                            >
                              <article
                                onClick={() => onSelectDeal(deal)}
                                className={cn(
                                  "min-w-0 cursor-pointer rounded-2xl bg-card p-3 text-left shadow-card transition-[transform,box-shadow] duration-200 ease-power4-out",
                                  dragSnapshot.isDragging && "rotate-[2deg] scale-[1.02] shadow-lift",
                                )}
                              >
                                <h3 className="text-[14px] font-medium leading-5 tracking-[-0.02em]">{deal.company_name}</h3>
                                {claude && (
                                  <div className="mt-1.5">
                                    <ViaClaude auditId={claude.id} actor={claude.actor_label} stop />
                                  </div>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  {deal.is_proprietary && <Tag tone={PROPRIETARY_TONE}>Proprietary</Tag>}
                                  {deal.is_passed && <Tag tone={PASSED_TONE}>Passed</Tag>}
                                  <IndustryChip industry={deal.industry} />
                                  <CountryChip country={deal.country} />
                                  {deal.deal_stage && <Tag tone={stageTone(deal.deal_stage)}>{displayStage(deal.deal_stage)}</Tag>}
                                </div>
                                {deal.is_passed && <p className="mt-1.5 text-[11px] text-muted-foreground">{passedAtLabel(deal.deal_stage)}</p>}
                                {(deal.passed_reason || deal.pass_reason) && (
                                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">{deal.passed_reason || deal.pass_reason}</p>
                                )}
                                {summary && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p
                                        title={deal.company_description ?? summary}
                                        className="mt-2 line-clamp-2 break-words font-sans text-[13px] leading-5 text-muted-foreground"
                                      >
                                        {summary}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-[min(18rem,calc(100vw-2rem))] whitespace-pre-wrap text-left font-sans text-[13px] font-normal leading-5">
                                      {deal.company_description}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <CardValuation deal={deal} className={summary ? "mt-1" : "mt-2"} />
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <div className="flex -space-x-1.5">
                                    {people.slice(0, 3).map((person) => (
                                      <span key={person.id} title={person.name} className="grid size-6 place-items-center rounded-full border border-background bg-foreground text-[9px] font-semibold text-background">
                                        {initials(person.name)}
                                      </span>
                                    ))}
                                  </div>
                                  <LoggedAge entryDate={deal.entry_date} createdAt={deal.created_at} />
                                </div>
                              </article>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {column.deals.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No deals</p>}
                  </div>
                )}
              </Droppable>
            </section>
          ))}
        </div>
        {hiddenColumns.length > 0 && !railOpen && (
          <button
            type="button"
            className="press hidden h-full w-8 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-secondary text-[11px] font-medium text-muted-foreground lg:flex"
            onClick={() => setRailOpen(true)}
            aria-expanded={false}
          >
            <span className="[writing-mode:vertical-rl]">Hidden {hiddenColumns.length}</span>
          </button>
        )}
        {hiddenColumns.length > 0 && railOpen && (
          <aside className="hidden w-44 shrink-0 flex-col rounded-2xl border border-border bg-secondary p-3 lg:flex">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Hidden</p>
              <button type="button" className="press text-[11px] text-muted-foreground" onClick={() => setRailOpen(false)}>Hide</button>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {hiddenColumns.map((column) => (
                <button
                  key={column.tier}
                  type="button"
                  className="press flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hoverable:hover:bg-accent"
                  onClick={() => setHidden((current) => current.filter((tier) => tier !== column.tier))}
                >
                  <span>{column.label}</span>
                  <span className="tabular-nums text-muted-foreground">{column.total}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
      </TooltipProvider>
    </DragDropContext>
  );
}
