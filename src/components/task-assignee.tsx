"use client";

import { Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SINGAPORE_TEAM, assigneeInitials, assigneeLabel, teamMemberFor, type TeamMember } from "@/lib/team";
import { cn } from "@/lib/utils";

function Avatar({ initials, color, className }: { initials: string; color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ring-1 ring-inset ring-black/10", className)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

function PersonAvatar({ owner, className }: { owner: string; className?: string }) {
  const member = teamMemberFor(owner);
  return <Avatar initials={member?.initials ?? assigneeInitials(owner)} color={member?.color ?? "#5C5C5C"} className={className} />;
}

export function TaskAssignee({
  owner,
  variant = "field",
  showName = false,
  onAssign,
}: {
  owner: string | null;
  variant?: "field" | "avatar";
  showName?: boolean;
  onAssign: (owner: string | null) => void;
}) {
  const label = assigneeLabel(owner);
  const current = teamMemberFor(owner);
  const unknown = Boolean(label && !current);

  const choose = (next: string | null) => {
    const stored = owner?.trim() || null;
    if (stored === next) return;
    onAssign(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label ? `Assigned to ${label}` : "Assign"}
        className={cn(
          "press shrink-0 touch-manipulation rounded-full text-muted-foreground outline-none hoverable:hover:bg-accent hoverable:hover:text-foreground focus-visible:shadow-focus data-[state=open]:bg-accent data-[state=open]:text-foreground",
          variant === "avatar" && "grid size-10 place-items-center",
          variant === "field" && "inline-flex h-10 min-w-10 max-w-full items-center gap-1.5",
          variant === "field" && label && !showName && "w-10 justify-center",
          variant === "field" && (!label || showName) && "px-1",
        )}
      >
        {label ? (
          <>
            <PersonAvatar owner={label} />
            {variant === "field" && showName ? <span className="max-w-[9rem] truncate text-xs font-medium text-foreground">{label}</span> : null}
          </>
        ) : variant === "avatar" ? (
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-dashed border-muted-foreground/70 text-[10px] font-medium">
            +
          </span>
        ) : (
          <>
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-dashed border-muted-foreground/70" />
            <span className="pr-1.5 text-xs font-medium">Assign</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="z-[80] w-[min(17.5rem,calc(100vw-1.5rem))] rounded-xl p-1.5 shadow-pop"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Assigned to</DropdownMenuLabel>
        {unknown && label ? (
          <AssigneeRow selected name={label} owner={label} onSelect={() => choose(label)} />
        ) : null}
        {unknown ? <DropdownMenuSeparator /> : null}
        {SINGAPORE_TEAM.map((member) => (
          <AssigneeRow
            key={member.email}
            member={member}
            name={member.name}
            selected={current?.email === member.email}
            onSelect={() => choose(member.name)}
          />
        ))}
        {label ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11 touch-manipulation rounded-lg px-2 text-sm" onSelect={() => choose(null)}>
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-dashed border-muted-foreground/70" />
              Unassign
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneeRow({
  member,
  owner,
  name,
  selected,
  onSelect,
}: {
  member?: TeamMember;
  owner?: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className="min-h-11 touch-manipulation gap-2.5 rounded-lg px-2"
      aria-checked={selected}
      title={member?.email}
      onSelect={onSelect}
    >
      {member ? <Avatar initials={member.initials} color={member.color} /> : owner ? <PersonAvatar owner={owner} /> : null}
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <Check aria-hidden="true" className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
    </DropdownMenuItem>
  );
}
