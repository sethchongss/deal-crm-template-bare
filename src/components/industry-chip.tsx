import { industryClass } from "@/lib/tag-styles";
import { cn } from "@/lib/utils";

export function IndustryChip({ industry, className }: { industry: string | null | undefined; className?: string }) {
  if (!industry) return null;
  return (
    <span className={cn("inline-flex h-5 max-w-full items-center truncate rounded-[5px] border px-1.5 text-[11px] font-medium leading-none tracking-[-0.01em]", industryClass(industry), className)}>
      {industry}
    </span>
  );
}
