"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, SlidersHorizontal } from "lucide-react";
import { ImportDealsButton } from "@/components/import-deals-dialog";
import { ProprietaryFilter } from "@/components/proprietary-filter";
import { AddDealDialog } from "@/components/add-deal-dialog";
import { KanbanBoard } from "@/components/kanban-board";
import { openDealQuery } from "@/components/app-shell";
import { useCrm } from "@/components/crm-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { readPipelineFilters, writePipelineFilters } from "@/lib/board-return";
import { exportDealsToExcel } from "@/lib/export";
import { INDUSTRIES } from "@/lib/industries";
import type { DealTier } from "@/types/database";

export default function PipelinePage() {
  const { deals, loading, error, refresh, createDeal } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pipeline = readPipelineFilters(searchParams.toString());
  const search = pipeline.q;
  const sector = pipeline.industry;
  const country = pipeline.country;
  const proprietary = pipeline.proprietary;
  const setPipeline = (patch: Partial<typeof pipeline>) => {
    const next = writePipelineFilters(searchParams.toString(), patch);
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTier, setAddTier] = useState<DealTier>("pipeline");

  const active = useMemo(() => deals.filter((deal) => !deal.archived), [deals]);
  const countries = useMemo(() => [...new Set(active.flatMap((deal) => deal.countries?.length ? deal.countries : deal.country ? [deal.country] : []))].sort(), [active]);

  const filters = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={search}
        onChange={(event) => setPipeline({ q: event.target.value })}
        placeholder="Search pipeline"
        className="h-8 w-full rounded-full border border-border bg-card px-3 text-xs sm:w-48"
      />
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={sector} onChange={(event) => setPipeline({ industry: event.target.value })}>
        <option value="">All industries</option>
        {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={country} onChange={(event) => setPipeline({ country: event.target.value })}>
        <option value="">All countries</option>
        {countries.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <ProprietaryFilter value={proprietary} onChange={(value) => setPipeline({ proprietary: value })} />
    </div>
  );

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading pipeline…</p>;
  if (error && deals.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="text-sm text-destructive" role="alert">{error}</p>
          <button type="button" className="mt-3 text-xs underline" onClick={() => void refresh()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-6">
        <div className="hidden md:block">{filters}</div>
        <button type="button" className="press inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs md:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="size-3.5" />
          Filters
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className="press inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs" onClick={() => void exportDealsToExcel(active)}>
            <Download className="size-3.5" />
            Export
          </button>
          <ImportDealsButton />
          <button
            type="button"
            className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background"
            onClick={() => { setAddTier("pipeline"); setAddOpen(true); }}
          >
            <Plus className="size-3.5" />
            New deal
          </button>
        </div>
      </div>
      {active.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 pb-12 text-center">
          <div className="max-w-sm space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-full border border-border bg-card">
              <Plus className="size-5" />
            </div>
            <h2 className="text-lg font-semibold">Your pipeline is empty</h2>
            <p className="text-sm text-muted-foreground">Add the first company you are looking at, or import an existing list from a spreadsheet.</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background"
                onClick={() => { setAddTier("pipeline"); setAddOpen(true); }}
              >
                <Plus className="size-4" />
                Create your first deal
              </button>
              <ImportDealsButton />
            </div>
          </div>
        </div>
      ) : (
      <div className="min-h-0 flex-1 px-3 pb-3 md:px-4">
        <KanbanBoard
          deals={active}
          searchQuery={search}
          sectorFilter={sector}
          countryFilter={country}
          proprietaryFilter={proprietary}
          onSelectDeal={(deal) => router.push(openDealQuery(pathname, searchParams.toString(), deal.id))}
          onAddDeal={(tier) => { setAddTier(tier); setAddOpen(true); }}
        />
      </div>
      )}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 transition-[transform] duration-300 ease-drawer">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
      <AddDealDialog open={addOpen} defaultTier={addTier} onClose={() => setAddOpen(false)} onCreate={createDeal} />
    </div>
  );
}
