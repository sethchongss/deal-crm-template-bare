import { cn } from "@/lib/utils";

/**
 * Neutral app mark drawn inline so it follows the current text colour.
 * Swap this SVG (or render your own logo) to rebrand.
 * Height is 1.4em so it matches the 13px wordmark line box (body line-height 1.4).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative block h-[1.4em] w-[1.4em] shrink-0", className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" />
        <path d="M10 21V11h5.5a5 5 0 0 1 0 10H10Z" stroke="var(--background, #fff)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
