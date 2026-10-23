"use client";

import type { Deal } from "@/types/database";
import { TIER_CONFIG } from "@/lib/constants";
import { CardValuation } from "@/components/card-valuation";
import { IndustryChip } from "@/components/industry-chip";
import { LoggedAge } from "@/components/logged-age";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";

interface ArchivedTableProps {
  deals: Deal[];
  onUnarchive: (id: string) => Promise<boolean>;
  onSelectDeal: (deal: Deal) => void;
}

export function ArchivedTable({ deals, onUnarchive, onSelectDeal }: ArchivedTableProps) {
  if (deals.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No archived deals.</p>;
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-full overflow-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-2 py-2 font-medium">Board</th>
              <th className="hidden px-2 py-2 font-medium sm:table-cell">Industry</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Country</th>
              <th className="px-2 py-2 text-right font-medium">EBITDA</th>
              <th className="px-2 py-2 text-right font-medium">Age</th>
              <th className="hidden px-2 py-2 font-medium lg:table-cell">Entry</th>
              <th className="px-2 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="cursor-pointer border-t border-border hoverable:hover:bg-accent" onClick={() => onSelectDeal(deal)}>
                <td className="px-4 py-2.5 font-medium">
                  <div>{deal.company_name}</div>
                  <CardValuation deal={deal} className="mt-0.5" />
                </td>
                <td className="px-2 py-2.5"><Tag tone={TIER_CONFIG[deal.tier].tone}>{TIER_CONFIG[deal.tier].label}</Tag></td>
                <td className="hidden px-2 py-2.5 sm:table-cell">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <IndustryChip industry={deal.industry} />
                    {deal.sector && <span className="text-muted-foreground">{deal.sector}</span>}
                    {!deal.industry && !deal.sector && "—"}
                  </span>
                </td>
                <td className="hidden px-2 py-2.5 text-muted-foreground md:table-cell">{deal.country || "—"}</td>
                <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">{deal.latest_ebitda || "—"}</td>
                <td className="px-2 py-2.5 text-right">
                  <LoggedAge entryDate={deal.entry_date} createdAt={deal.created_at} />
                </td>
                <td className="hidden px-2 py-2.5 text-muted-foreground lg:table-cell">{formatDate(deal.entry_date, "d MMM yy")}</td>
                <td className="px-2 py-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUnarchive(deal.id);
                    }}
                  >
                    Restore
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
