"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dealLoggedOn, loggedAge, loggedAgeTitle } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LoggedAge({
  entryDate,
  createdAt,
  className,
}: {
  entryDate?: string | null;
  createdAt?: string | null;
  className?: string;
}) {
  const loggedOn = dealLoggedOn(entryDate, createdAt);
  const label = loggedAge(loggedOn);
  const title = loggedAgeTitle(loggedOn);
  if (!label || !title) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span title={title} className={cn("shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground", className)}>
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
