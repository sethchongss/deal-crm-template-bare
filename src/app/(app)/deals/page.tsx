"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DealTable } from "@/components/deal-table";
import { openDealQuery } from "@/components/app-shell";

export default function DealsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0">
      <DealTable onSelect={(deal) => router.push(openDealQuery(pathname, searchParams.toString(), deal.id))} />
    </div>
  );
}
