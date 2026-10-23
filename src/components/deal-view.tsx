"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Expand, Pencil, Trash2, X } from "lucide-react";
import { DealEditor } from "@/components/deal-editor";
import { DealGantt } from "@/components/deal-gantt";
import { ScreeningDisplay } from "@/components/screening-display";
import { ScreeningUpload } from "@/components/screening-upload";
import { Tag } from "@/components/tag";
import { useCrm } from "@/components/crm-provider";
import { ViaClaude } from "@/components/via-claude";
import { Button } from "@/components/ui/button";
import { useDealActivities } from "@/hooks/use-deals";
import { TIER_CONFIG } from "@/lib/constants";
import { CountryChip } from "@/components/country-chip";
import { IndustryChip } from "@/components/industry-chip";
import { DEAL_EXPAND_KEY, DEAL_RETURN_KEY, fullPageNavigation } from "@/lib/board-return";
import { daysUntil, formatDate } from "@/lib/format";
import { STANDARD_TEMPLATE, templateDate } from "@/lib/task-dates";
import { latestUpdateAfterDelete, latestUpdateAfterEdit, latestUpdateFromNote } from "@/lib/latest-update";
import { displayStage, passedAtLabel, stageTone } from "@/lib/passed";
import { PASSED_TONE, PROPRIETARY_TONE } from "@/lib/tag-styles";
import { supabase } from "@/lib/supabase";
import type { Deal, DealActivity, DealStageHistory, DealTask, DealWorkstream } from "@/types/database";

const fieldClass = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:shadow-focus";
const areaClass = "min-h-20 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus-visible:shadow-focus";

function NoteRow({
  activity,
  mark,
  onSave,
  onDelete,
}: {
  activity: DealActivity;
  mark: { id: string; actor_label: string | null } | null;
  onSave: (content: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activity.content);
  const [busy, setBusy] = useState(false);
  const pending = activity.id.startsWith("pending-");

  const cancel = () => {
    setDraft(activity.content);
    setEditing(false);
  };

  const save = async () => {
    const next = draft.trim();
    if (!next || next === activity.content) {
      cancel();
      return;
    }
    setBusy(true);
    const ok = await onSave(next);
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <li className="rounded-xl bg-secondary px-3 py-2">
      {editing ? (
        <>
          <textarea
            className={areaClass}
            aria-label="Edit note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancel();
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void save();
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={cancel}>Cancel</Button>
            <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => void save()}>Save</Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{activity.content}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{formatDate(activity.created_at, "d MMM yyyy, HH:mm")}</span>
              {mark ? <ViaClaude auditId={mark.id} actor={mark.actor_label} /> : null}
            </p>
            {pending ? null : (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  className="press grid size-7 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground"
                  aria-label="Edit note"
                  onClick={() => {
                    setDraft(activity.content);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="press grid size-7 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground"
                  aria-label="Delete note"
                  onClick={onDelete}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export function DealView({ deal, mode, onClose }: { deal: Deal; mode: "drawer" | "page"; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { updateDeal, deleteDeal, archiveDeal, unarchiveDeal, refresh, notify, claudeMarks } = useCrm();
  const { activities, error: activityError, addActivity, updateActivity, deleteActivity } = useDealActivities(deal.id);
  const [note, setNote] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [workstreams, setWorkstreams] = useState<DealWorkstream[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [history, setHistory] = useState<DealStageHistory[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const assigneeEpoch = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDetailLoading(true);
      const [streamResult, taskResult, historyResult] = await Promise.all([
        supabase.from("deal_workstreams").select("*").eq("deal_id", deal.id).order("sort_order"),
        supabase.from("deal_tasks").select("*").eq("deal_id", deal.id).order("sort_order"),
        supabase.from("deal_stage_history").select("*").eq("deal_id", deal.id).order("changed_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const failed = streamResult.error || taskResult.error || historyResult.error;
      setDetailError(failed?.message ?? null);
      setWorkstreams(streamResult.data || []);
      setTasks(taskResult.data || []);
      setHistory(historyResult.data || []);
      setDetailLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  const logNote = async (text: string) => {
    const submission = latestUpdateFromNote(text);
    if (!submission) return false;
    setUpdateError(null);
    const created = await addActivity(submission.content);
    if (!created) return false;
    const ok = await updateDeal(deal.id, submission.patch);
    if (!ok) {
      setUpdateError("The note was saved, but the latest update on the deal did not.");
      return false;
    }
    return true;
  };

  const saveUpdate = async () => {
    if (savingUpdate) return;
    setSavingUpdate(true);
    try {
      const ok = await logNote(updateText);
      if (ok) {
        setUpdateText("");
        notify("Update saved");
      }
    } finally {
      setSavingUpdate(false);
    }
  };

  const addNote = async () => {
    const ok = await logNote(note);
    if (ok) setNote("");
  };

  const saveEditedNote = async (activity: DealActivity, content: string) => {
    const updated = await updateActivity(activity.id, content);
    if (!updated) return false;
    const nextLatest = latestUpdateAfterEdit(activities[0]?.id === activity.id, updated.content, deal.latest_update);
    if (nextLatest !== deal.latest_update) {
      const ok = await updateDeal(deal.id, { latest_update: nextLatest });
      if (!ok) setUpdateError("The note was edited, but the latest update on the deal did not change.");
    }
    return true;
  };

  const removeNote = async (activity: DealActivity) => {
    if (!window.confirm("Delete this note?")) return;
    const deletedIsNewest = activities[0]?.id === activity.id;
    const remaining = activities.filter((item) => item.id !== activity.id);
    const ok = await deleteActivity(activity.id);
    if (!ok) return;
    const patch = latestUpdateAfterDelete(
      deletedIsNewest,
      remaining[0] ? { content: remaining[0].content, created_at: remaining[0].created_at } : null,
    );
    if (!patch) return;
    const saved = await updateDeal(deal.id, patch);
    if (!saved) setUpdateError("The note was deleted, but the latest update on the deal did not change.");
  };

  const addWorkstream = async (name: string) => {
    const { data, error } = await supabase
      .from("deal_workstreams")
      .insert({ deal_id: deal.id, name, sort_order: workstreams.length })
      .select()
      .single();
    if (error || !data) {
      setDetailError(error?.message || "Couldn't add that workstream.");
      return false;
    }
    setWorkstreams((current) => [...current, data]);
    return true;
  };

  const renameWorkstream = async (id: string, name: string) => {
    const { error } = await supabase.from("deal_workstreams").update({ name }).eq("id", id);
    if (error) {
      setDetailError(error.message);
      return false;
    }
    setWorkstreams((current) => current.map((item) => (item.id === id ? { ...item, name } : item)));
    return true;
  };

  const deleteWorkstream = async (id: string) => {
    const { error } = await supabase.from("deal_workstreams").delete().eq("id", id);
    if (error) {
      setDetailError(error.message);
      return false;
    }
    setWorkstreams((current) => current.filter((item) => item.id !== id));
    setTasks((current) => current.filter((item) => item.workstream_id !== id));
    return true;
  };

  const addTask = async (workstreamId: string, title: string) => {
    const sort = tasks.filter((task) => task.workstream_id === workstreamId).length;
    const { data, error } = await supabase
      .from("deal_tasks")
      .insert({ workstream_id: workstreamId, deal_id: deal.id, title, sort_order: sort, status: "not_started", is_milestone: false })
      .select()
      .single();
    if (error || !data) {
      setDetailError(error?.message || "Couldn't add that task.");
      return false;
    }
    setTasks((current) => [...current, data]);
    return true;
  };

  const updateTask = async (id: string, patch: Partial<DealTask>) => {
    if ("owner" in patch) {
      const nextOwner = patch.owner ?? null;
      const rollbackTo = tasks.find((task) => task.id === id)?.owner ?? null;
      if (rollbackTo === nextOwner) return true;
      const token = (assigneeEpoch.current.get(id) ?? 0) + 1;
      assigneeEpoch.current.set(id, token);
      setTasks((current) => current.map((task) => (task.id === id ? { ...task, owner: nextOwner } : task)));
      const { data, error } = await supabase.from("deal_tasks").update({ owner: nextOwner }).eq("id", id).select("owner").maybeSingle();
      if (assigneeEpoch.current.get(id) !== token) return !error && Boolean(data);
      if (error || !data) {
        const fresh = await supabase.from("deal_tasks").select("owner").eq("id", id).maybeSingle();
        if (assigneeEpoch.current.get(id) !== token) return false;
        const restored = fresh.data ? fresh.data.owner : rollbackTo;
        setTasks((current) => current.map((task) => (task.id === id ? { ...task, owner: restored } : task)));
        notify("Couldn't save the assignee.");
        return false;
      }
      return true;
    }
    const { error } = await supabase.from("deal_tasks").update(patch).eq("id", id);
    if (error) {
      setDetailError(error.message);
      return false;
    }
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    return true;
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("deal_tasks").delete().eq("id", id);
    if (error) {
      setDetailError(error.message);
      return false;
    }
    setTasks((current) => current.filter((task) => task.id !== id));
    return true;
  };

  const restoreTask = async (task: DealTask) => {
    const { data, error } = await supabase.from("deal_tasks").insert(task).select().single();
    if (error || !data) {
      setDetailError(error?.message || "Couldn't restore that task.");
      return false;
    }
    setTasks((current) => [...current, data]);
    return true;
  };

  const applyTemplate = async () => {
    let order = workstreams.length;
    for (const stream of STANDARD_TEMPLATE) {
      const { data, error } = await supabase.from("deal_workstreams").insert({ deal_id: deal.id, name: stream.name, sort_order: order }).select().single();
      if (error || !data) {
        setDetailError(error?.message || "Couldn't start the template.");
        return false;
      }
      order += 1;
      const rows = stream.tasks.map((task, index) => ({
        workstream_id: data.id,
        deal_id: deal.id,
        title: task.title,
        start_date: templateDate(task.start),
        end_date: templateDate(task.end),
        is_milestone: Boolean(task.milestone),
        status: "not_started" as const,
        sort_order: index,
      }));
      const inserted = await supabase.from("deal_tasks").insert(rows).select();
      if (inserted.error) {
        setDetailError(inserted.error.message);
        return false;
      }
      setWorkstreams((current) => [...current, data]);
      setTasks((current) => [...current, ...(inserted.data || [])]);
    }
    return true;
  };

  const openFullPage = () => {
    const nav = fullPageNavigation(pathname, searchParams.toString(), deal.id);
    sessionStorage.setItem(DEAL_RETURN_KEY, nav.replace);
    sessionStorage.setItem(DEAL_EXPAND_KEY, nav.push);
    router.replace(nav.replace);
  };

  const leaveFullPage = () => {
    const board = sessionStorage.getItem(DEAL_RETURN_KEY);
    sessionStorage.removeItem(DEAL_RETURN_KEY);
    if (board) {
      router.back();
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${deal.company_name}?`)) return;
    const ok = await deleteDeal(deal.id);
    if (ok) onClose?.();
  };

  const boardTier = deal.is_passed || deal.tier === "passed" ? "passed" : deal.tier;
  const exclusivity = daysUntil(deal.exclusivity_end_date);
  const hasScreening = Boolean(deal.screening_score && deal.screening_thesis);
  const dealMark = claudeMarks.find((mark) => mark.table_name === "deals" && mark.row_id === deal.id);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border px-4 py-4 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {mode === "page" ? "Deal" : TIER_CONFIG[boardTier].label}
            </p>
            <h1 className="truncate text-xl font-semibold tracking-[-0.03em]">{deal.company_name}</h1>
            {dealMark && (
              <div className="mt-1.5">
                <ViaClaude auditId={dealMark.id} actor={dealMark.actor_label} />
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {deal.is_proprietary && <Tag tone={PROPRIETARY_TONE}>Proprietary</Tag>}
              <Tag tone={TIER_CONFIG[boardTier].tone}>{TIER_CONFIG[boardTier].label}</Tag>
              {deal.is_passed && <Tag tone={PASSED_TONE}>Passed</Tag>}
              {deal.deal_stage && <Tag tone={stageTone(deal.deal_stage)}>{displayStage(deal.deal_stage)}</Tag>}
              {deal.is_passed && <span className="text-xs text-muted-foreground">{passedAtLabel(deal.deal_stage)}</span>}
              <IndustryChip industry={deal.industry} />
              {deal.sector && <span className="text-xs text-muted-foreground">{deal.sector}</span>}
              <CountryChip country={deal.country} />
              {deal.archived && <Tag tone="neutral">Archived</Tag>}
            </div>
            {(deal.passed_reason || deal.pass_reason) && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">{deal.passed_reason || deal.pass_reason}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {mode === "page" && (
              <button
                type="button"
                className="press inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm hoverable:hover:bg-accent"
                onClick={leaveFullPage}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            )}
            {mode === "drawer" && (
              <button type="button" className="press grid size-9 place-items-center rounded-lg hoverable:hover:bg-accent" onClick={openFullPage} aria-label="Open full page">
                <Expand className="size-4" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="press grid size-9 place-items-center rounded-lg hoverable:hover:bg-accent"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Target {formatDate(deal.target_completion_date)}</span>
          <span>Exclusivity {formatDate(deal.exclusivity_end_date)}{exclusivity ? ` · ${exclusivity}` : ""}</span>
          <span>Extension {formatDate(deal.exclusivity_extension_date)}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-auto px-4 py-5 md:px-6">
        {detailError && <p className="text-sm text-destructive" role="alert">{detailError}</p>}

        <section className="rounded-2xl bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold tracking-[-0.02em]">Latest update</h2>
          {deal.latest_update ? (
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">{deal.latest_update}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No update yet.</p>
          )}
          <textarea
            className={`${areaClass} mt-3`}
            aria-label="Latest update"
            value={updateText}
            onChange={(event) => setUpdateText(event.target.value)}
            placeholder="What changed?"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void saveUpdate();
              }
            }}
          />
          {updateError && <p className="mt-2 text-sm text-destructive" role="alert">{updateError}</p>}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">{deal.latest_update_at ? `Last saved ${formatDate(deal.latest_update_at, "d MMM yyyy, HH:mm")}` : "The box clears after each save."}</p>
            <Button type="button" size="sm" onClick={saveUpdate} disabled={savingUpdate || !updateText.trim()}>
              {savingUpdate ? "Saving…" : "Save update"}
            </Button>
          </div>
        </section>

        <DealEditor
          key={deal.id}
          deal={deal}
          afterTransaction={detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading workstreams…</p>
          ) : (
            <DealGantt
              layout={mode}
              deal={deal}
              workstreams={workstreams}
              tasks={tasks}
              onAddWorkstream={addWorkstream}
              onRenameWorkstream={renameWorkstream}
              onDeleteWorkstream={deleteWorkstream}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onRestoreTask={restoreTask}
              onApplyTemplate={applyTemplate}
            />
          )}
        />

        <section className="rounded-2xl bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold tracking-[-0.02em]">Notes</h2>
          {activityError && <p className="mt-2 text-sm text-destructive" role="alert">{activityError}</p>}
          <div className="mt-3 flex gap-2">
            <input className={fieldClass} value={note} placeholder="Add a note" onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addNote(); }} />
            <Button type="button" onClick={addNote}>Add</Button>
          </div>
          <ul className="mt-3 space-y-2">
            {activities.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
            {activities.map((activity) => {
              const mark = claudeMarks.find((item) => item.table_name === "deal_activities" && item.row_id === activity.id) ?? null;
              return (
                <NoteRow
                  key={activity.id}
                  activity={activity}
                  mark={mark}
                  onSave={(content) => saveEditedNote(activity, content)}
                  onDelete={() => void removeNote(activity)}
                />
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold tracking-[-0.02em]">Documents</h2>
          {hasScreening && !showUpload ? (
            <ScreeningDisplay deal={deal} onReupload={() => setShowUpload(true)} />
          ) : showUpload || !hasScreening ? (
            <div className="space-y-3">
              <ScreeningUpload deal={deal} onUpdate={() => { setShowUpload(false); void refresh(); }} />
              {hasScreening && <Button type="button" variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancel upload</Button>}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold tracking-[-0.02em]">Stage history</h2>
          <ol className="mt-3 space-y-3">
            {history.length === 0 && <li className="text-sm text-muted-foreground">No stage changes recorded.</li>}
            {history.map((row) => {
              const mark = claudeMarks.find((item) => item.table_name === "deal_stage_history" && item.row_id === row.id);
              return (
              <li key={row.id} className="border-l-2 border-border pl-3">
                <p className="text-sm">
                  <span className="font-medium capitalize">{row.field}</span>
                  {" "}
                  {row.from_value || "—"} → {row.to_value || "—"}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatDate(row.changed_at, "d MMM yyyy, HH:mm")}{row.note ? ` · ${row.note}` : ""}</span>
                  {mark && <ViaClaude auditId={mark.id} actor={mark.actor_label} />}
                </p>
              </li>
              );
            })}
          </ol>
        </section>

        <div className="flex flex-wrap gap-2 pb-6">
          <Button type="button" variant="outline" onClick={() => (deal.archived ? unarchiveDeal(deal.id) : archiveDeal(deal.id))}>
            {deal.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {deal.archived ? "Unarchive" : "Archive"}
          </Button>
          <Button type="button" variant="destructive" onClick={remove}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

