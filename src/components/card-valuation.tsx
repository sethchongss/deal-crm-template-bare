"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cardValuation, type CardValuationInput } from "@/lib/card-valuation";
import { cn } from "@/lib/utils";

export function CardValuation({
  deal,
  className,
}: {
  deal: CardValuationInput;
  className?: string;
}) {
  const valuation = cardValuation(deal);
  if (!valuation.line) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p
          title={valuation.title ?? undefined}
          className={cn(
            "line-clamp-2 break-words font-sans text-[12px] font-normal leading-4 tabular-nums text-muted-foreground",
            className,
          )}
        >
          {valuation.line}
        </p>
      </TooltipTrigger>
      {valuation.title && (
        <TooltipContent
          side="bottom"
          className="max-w-[min(18rem,calc(100vw-2rem))] text-left font-sans text-[12px] font-normal leading-4"
        >
          {valuation.title}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
