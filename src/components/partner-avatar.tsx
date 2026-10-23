"use client";

import { Trash2 } from "lucide-react";
import { Tag } from "@/components/tag";
import { ROLE_ON_DEAL_LABEL, ROLES_ON_DEAL, TAG_CLASS } from "@/lib/constants";
import { avatarTone, partnerChips, partnerInitials, type PartnerChip } from "@/lib/partners";
import { cn } from "@/lib/utils";
import type { PartnerRole, RoleOnDeal } from "@/types/database";

const SIZE = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-[11px]",
  lg: "size-11 text-sm",
} as const;

export function PartnerAvatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE }) {
  const tone = avatarTone(name);
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", TAG_CLASS[tone], SIZE[size])}
    >
      {partnerInitials(name)}
    </span>
  );
}

export function PartnerChipList({ chips }: { chips: PartnerChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <Tag key={chip.key} tone={chip.tone} className={chip.kind === "firm" ? "max-w-[14rem] min-w-0 overflow-hidden" : undefined}>
          {chip.kind === "firm" ? <span className="truncate">{chip.label}</span> : chip.label}
        </Tag>
      ))}
    </div>
  );
}

export function PartnerTags({
  type,
  company,
  roleOnDeal,
  dealRoles,
}: {
  type?: PartnerRole | null;
  company?: string | null;
  roleOnDeal?: RoleOnDeal | null;
  dealRoles?: RoleOnDeal[];
}) {
  const includeRoles = roleOnDeal != null || (dealRoles?.length ?? 0) > 0;
  return (
    <PartnerChipList
      chips={partnerChips({
        type,
        company,
        roles: roleOnDeal ? [roleOnDeal] : dealRoles,
        includeRoles,
      })}
    />
  );
}

export function PartnerSummary({
  name,
  subtitle,
  type,
  company,
  dealRoles,
}: {
  name: string;
  subtitle?: string | null;
  type?: PartnerRole | null;
  company?: string | null;
  dealRoles?: RoleOnDeal[];
}) {
  return (
    <div className="flex items-start gap-3">
      <PartnerAvatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-1.5">
          <PartnerTags type={type} company={company} dealRoles={dealRoles} />
        </div>
      </div>
    </div>
  );
}

export function DealPartnerCard({
  name,
  type,
  company,
  roleOnDeal,
  onRoleChange,
  onRemove,
}: {
  name: string;
  type?: PartnerRole | null;
  company?: string | null;
  roleOnDeal: RoleOnDeal;
  onRoleChange: (role: RoleOnDeal) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <PartnerAvatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <button
              type="button"
              className="press grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground"
              aria-label={`Remove ${name}`}
              onClick={onRemove}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className="mt-1.5">
            <PartnerTags type={type} company={company} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">Role on deal</span>
            <select
              aria-label={`Role on deal for ${name}`}
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              value={roleOnDeal}
              onChange={(event) => onRoleChange(event.target.value as RoleOnDeal)}
            >
              {ROLES_ON_DEAL.map((role) => (
                <option key={role} value={role}>{ROLE_ON_DEAL_LABEL[role]}</option>
              ))}
              {ROLES_ON_DEAL.includes(roleOnDeal) ? null : (
                <option value={roleOnDeal}>{ROLE_ON_DEAL_LABEL[roleOnDeal]}</option>
              )}
            </select>
          </label>
        </div>
      </div>
    </article>
  );
}
