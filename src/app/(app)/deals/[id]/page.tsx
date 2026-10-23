"use client";

import { use } from "react";
import Link from "next/link";
import { DealView } from "@/components/deal-view";
import { useCrm } from "@/components/crm-provider";

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { deals, loading, error, refresh } = useCrm();
  const deal = deals.find((item) => item.id === id);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading deal…</p>;
  if (error && !deal) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive" role="alert">{error}</p>
        <button type="button" className="mt-3 text-xs underline" onClick={() => void refresh()}>Try again</button>
      </div>
    );
  }
  if (!deal) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="text-sm">This deal is not in the pipeline.</p>
          <Link href="/deals" className="mt-3 inline-block text-xs underline">Back to deals</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0">
      <DealView key={deal.id} deal={deal} mode="page" />
    </div>
  );
}
