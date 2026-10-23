"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArchivedTable } from "@/components/archived-table";
import { openDealQuery } from "@/components/app-shell";
import { useCrm } from "@/components/crm-provider";
import { orderBoardDeals } from "@/lib/kanban-order";

export default function ArchivePage() {
  const { deals, loading, error, unarchiveDeal } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const archived = orderBoardDeals(deals.filter((deal) => deal.archived));

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading archive…</p>;
  if (error && deals.length === 0) return <p className="p-6 text-sm text-destructive" role="alert">{error}</p>;

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 p-4 md:p-6">
      <ArchivedTable
        deals={archived}
        onUnarchive={unarchiveDeal}
        onSelectDeal={(deal) => router.push(openDealQuery(pathname, searchParams.toString(), deal.id))}
      />
    </div>
  );
}
