import { TAG_CLASS, type TagTone } from "@/lib/tag-styles";
import { cn } from "@/lib/utils";

export function Tag({ tone, children, className }: { tone: TagTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-[5px] border px-1.5 text-[11px] font-medium leading-none tracking-[-0.01em]", TAG_CLASS[tone], className)}>
      {children}
    </span>
  );
}
