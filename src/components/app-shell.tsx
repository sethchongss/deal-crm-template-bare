"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Archive,
  FolderCheck,

  LayoutGrid,
  Menu,
  Moon,
  PanelLeft,
  Search,
  Sun,
  Table2,
  Timer,
  Users,
  X,
} from "lucide-react";
import { AccountBar } from "@/components/account-bar";
import { CrmProvider, useCrm } from "@/components/crm-provider";
import { DealView } from "@/components/deal-view";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { DEAL_EXPAND_KEY, fullPagePushTarget } from "@/lib/board-return";
import { TIER_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Pipeline", icon: LayoutGrid },
  { href: "/deals", label: "Deals", icon: Table2 },
  { href: "/timeline", label: "Timeline", icon: Timer },
  { href: "/partners", label: "Partners", icon: Users },
  { href: "/realized", label: "Realized", icon: FolderCheck },
  { href: "/archive", label: "Archive", icon: Archive },
];

function crumb(pathname: string, dealName?: string) {
  if (pathname.startsWith("/deals/")) return ["Deals", dealName || "Deal"];
  const item = NAV.find((entry) => entry.href === pathname);
  return item ? [item.label] : [APP_NAME];
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center px-4", collapsed && "justify-center px-2")}>
        <Link
          href="/"
          aria-label={collapsed ? APP_NAME : undefined}
          className={cn("flex h-10 items-center gap-2 text-[13px] leading-[1.4]", collapsed && "w-10 justify-center")}
          onClick={onNavigate}
        >
          <BrandMark />
          {!collapsed && (
            <span className="font-semibold tracking-[-0.03em]">
              {APP_NAME}
            </span>
          )}
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground transition-[background-color,color] duration-150 ease-power3-out",
                collapsed && "justify-center px-0",
                active ? "bg-sidebar-accent text-foreground" : "hoverable:hover:bg-sidebar-accent hoverable:hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <p className="px-4 pb-4 text-[11px] text-muted-foreground">Internal · strictly private</p>
      )}
    </div>
  );
}

function CommandMenu({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { deals, partners } = useCrm();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const dealHits = useMemo(
    () => deals.filter((deal) => !q || [deal.company_name, deal.industry, deal.sector_group, deal.sector, deal.country].some((field) => field?.toLowerCase().includes(q))).slice(0, 8),
    [deals, q],
  );
  const partnerHits = useMemo(
    () => partners.filter((partner) => !q || [partner.name, partner.company, partner.job_title].some((field) => field?.toLowerCase().includes(q))).slice(0, 6),
    [partners, q],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={() => onOpenChange(false)}>
      <div
        role="dialog"
        aria-label="Search"
        className="mx-auto mt-[12vh] w-[min(560px,calc(100%-1.5rem))] overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search deals and partners"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="button" className="press rounded-md p-1 text-muted-foreground" onClick={() => onOpenChange(false)} aria-label="Close search">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-auto p-2">
          <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Deals</p>
          {dealHits.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No deals</p>}
          {dealHits.map((deal) => (
            <button
              key={deal.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hoverable:hover:bg-accent"
              onClick={() => {
                onOpenChange(false);
                router.push(`/deals/${deal.id}`);
              }}
            >
              <span className="text-sm font-medium">{deal.company_name}</span>
              <span className="text-xs text-muted-foreground">{TIER_CONFIG[deal.tier].label}</span>
            </button>
          ))}
          <p className="mt-2 px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Partners</p>
          {partnerHits.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No partners</p>}
          {partnerHits.map((partner) => (
            <button
              key={partner.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hoverable:hover:bg-accent"
              onClick={() => {
                onOpenChange(false);
                router.push(`/partners?partner=${partner.id}`);
              }}
            >
              <span className="text-sm font-medium">{partner.name}</span>
              <span className="text-xs text-muted-foreground">{partner.company}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { deals, toast } = useCrm();
  const { dark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localStorage.getItem("sidebar-collapsed") === "1") setCollapsed(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dealParam = searchParams.get("deal");

  useEffect(() => {
    const target = fullPagePushTarget(dealParam, sessionStorage.getItem(DEAL_EXPAND_KEY));
    if (!target) return;
    sessionStorage.removeItem(DEAL_EXPAND_KEY);
    router.push(target);
  }, [dealParam, router]);
  const fullPage = /^\/deals\/[^/]+$/.test(pathname);
  const drawerDeal = !fullPage && dealParam ? deals.find((deal) => deal.id === dealParam) ?? null : null;
  const pageDeal = fullPage ? deals.find((deal) => pathname.endsWith(deal.id)) : undefined;
  const crumbs = crumb(pathname, pageDeal?.company_name);

  const closeDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("deal");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside
        className="hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-smooth-in-out md:block"
        style={{ width: collapsed ? 68 : 254 }}
      >
        <SidebarBody collapsed={collapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:px-4">
          <button type="button" className="press grid size-9 place-items-center rounded-lg md:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu className="size-4" />
          </button>
          <button
            type="button"
            className="press hidden size-9 place-items-center rounded-lg text-muted-foreground hoverable:hover:bg-accent md:grid"
            onClick={() => {
              setCollapsed((value) => {
                localStorage.setItem("sidebar-collapsed", value ? "0" : "1");
                return !value;
              });
            }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="size-4" />
          </button>
          <div className="flex min-w-0 flex-1 items-center text-[13px] leading-[1.4] text-muted-foreground">
            <Link href="/" className="press mr-1 grid size-10 shrink-0 place-items-center md:hidden" aria-label={APP_NAME}>
              <BrandMark />
            </Link>
            <div className="min-w-0 truncate">
            <span>{APP_NAME}</span>
            {crumbs.map((item) => (
              <span key={item}>
                <span className="px-1.5 text-muted-foreground">/</span>
                <span className="text-foreground">{item}</span>
              </span>
            ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="press hidden h-8 items-center gap-2 rounded-full border border-border bg-secondary px-3 text-xs text-muted-foreground sm:inline-flex"
          >
            <Search className="size-3.5" />
            Search
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <button type="button" className="press grid size-9 place-items-center rounded-lg sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
            <Search className="size-4" />
          </button>
          <button type="button" className="press relative grid size-9 place-items-center rounded-lg" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
            <Sun className={cn("size-4 transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]", dark ? "scale-100 opacity-100 blur-0" : "absolute scale-[0.25] opacity-0 blur-[4px]")} />
            <Moon className={cn("size-4 transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]", dark ? "absolute scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0")} />
          </button>
          <AccountBar />
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[280px] bg-sidebar p-0 transition-[transform] duration-300 ease-drawer sm:max-w-none">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody collapsed={false} onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={!!drawerDeal} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent side="right" showCloseButton={false} className="w-full max-w-none gap-0 overflow-hidden p-0 transition-[transform] duration-300 ease-drawer sm:max-w-[640px] md:w-[min(720px,92vw)]">
          <SheetTitle className="sr-only">{drawerDeal?.company_name ?? "Deal"}</SheetTitle>
          {drawerDeal && <DealView key={drawerDeal.id} deal={drawerDeal} mode="drawer" onClose={closeDrawer} />}
        </SheetContent>
      </Sheet>

      {commandOpen && <CommandMenu onOpenChange={setCommandOpen} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="animate-toast-in rounded-full bg-[#121212] px-4 py-2 text-[13px] font-medium text-white shadow-pop">{toast}</div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center text-sm text-muted-foreground">Loading pipeline…</div>}>
      <CrmProvider>
          <ShellFrame>{children}</ShellFrame>
      </CrmProvider>
    </Suspense>
  );
}

export function openDealQuery(pathname: string, search: string, id: string) {
  const params = new URLSearchParams(search);
  params.set("deal", id);
  return `${pathname}?${params.toString()}`;
}
