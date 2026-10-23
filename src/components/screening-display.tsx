"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckSquare, ExternalLink, FileText, TrendingUp } from "lucide-react";
import { useCrm } from "@/components/crm-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Deal } from "@/types/database";

const area = "mt-1 min-h-20 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus-visible:shadow-focus";
const line = "h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:shadow-focus";

interface ScreeningDisplayProps {
  deal: Deal;
  onReupload?: () => void;
}

function linesOf(value: string[] | null | undefined) {
  return value && value.length > 0 ? value : [""];
}

export function ScreeningDisplay({ deal, onReupload }: ScreeningDisplayProps) {
  const { updateDeal } = useCrm();
  const [score, setScore] = useState(deal.screening_score == null ? "" : String(deal.screening_score));
  const [thesis, setThesis] = useState(deal.screening_thesis ?? "");
  const [whyOwn, setWhyOwn] = useState(deal.screening_why_own ?? "");
  const [whyNow, setWhyNow] = useState(deal.screening_why_now ?? "");
  const [exitStory, setExitStory] = useState(deal.screening_exit_story ?? "");
  const [missing, setMissing] = useState(linesOf(deal.screening_missing_data));
  const [steps, setSteps] = useState(linesOf(deal.screening_next_steps));

  useEffect(() => {
    setScore(deal.screening_score == null ? "" : String(deal.screening_score));
    setThesis(deal.screening_thesis ?? "");
    setWhyOwn(deal.screening_why_own ?? "");
    setWhyNow(deal.screening_why_now ?? "");
    setExitStory(deal.screening_exit_story ?? "");
    setMissing(linesOf(deal.screening_missing_data));
    setSteps(linesOf(deal.screening_next_steps));
  }, [deal.id, deal.screening_score, deal.screening_thesis, deal.screening_why_own, deal.screening_why_now, deal.screening_exit_story, deal.screening_missing_data, deal.screening_next_steps]);

  if (!deal.screening_score && !deal.screening_thesis) return null;

  const save = (patch: Partial<Deal>) => void updateDeal(deal.id, patch);
  const saveText = (key: "screening_thesis" | "screening_why_own" | "screening_why_now" | "screening_exit_story", draft: string, current: string | null) => {
    const next = draft.trim() || null;
    if (next !== (current || null)) save({ [key]: next });
  };
  const saveLines = (key: "screening_missing_data" | "screening_next_steps", draft: string[], current: string[] | null) => {
    const next = draft.map((item) => item.trim()).filter(Boolean);
    const previous = current ?? [];
    if (next.join("\n") === previous.join("\n")) return;
    save({ [key]: next.length > 0 ? next : null });
  };
  const saveScore = () => {
    const raw = score.trim();
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100 || value === deal.screening_score) return;
    save({ screening_score: value });
  };

  const tone = !deal.screening_score ? "text-muted-foreground border-border" : deal.screening_score >= 80 ? "text-green-700 bg-green-50 border-green-200" : deal.screening_score >= 60 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-stone-700 bg-stone-100 border-stone-200";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Target Screening Analysis</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {deal.screening_pdf_url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={deal.screening_pdf_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View PDF
                  </a>
                </Button>
              ) : null}
              {onReupload ? <Button variant="outline" size="sm" onClick={onReupload}>Re-upload</Button> : null}
            </div>
          </div>
          {deal.screening_updated_at ? <CardDescription>Last updated: {formatDate(deal.screening_updated_at, "d MMM yyyy, HH:mm")}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className={`rounded-lg border-2 p-4 ${tone}`}>
              <label className="text-sm font-medium">
                Deal score
                <input
                  aria-label="Deal score"
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 block h-10 w-24 rounded-lg border border-border bg-background px-2 text-2xl font-bold text-foreground"
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  onBlur={saveScore}
                />
              </label>
            </div>
            {deal.screening_score != null ? (
              <Badge variant={deal.screening_score >= 80 ? "default" : deal.screening_score >= 60 ? "secondary" : "destructive"}>
                {deal.screening_score >= 80 ? "Strong" : deal.screening_score >= 60 ? "Moderate" : "Weak"} Opportunity
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Investment Thesis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-semibold">Summary
            <textarea aria-label="Screening summary" className={area} value={thesis} onChange={(event) => setThesis(event.target.value)} onBlur={() => saveText("screening_thesis", thesis, deal.screening_thesis)} />
          </label>
          <label className="block text-sm font-semibold">Why own it?
            <textarea aria-label="Why own it" className={area} value={whyOwn} onChange={(event) => setWhyOwn(event.target.value)} onBlur={() => saveText("screening_why_own", whyOwn, deal.screening_why_own)} />
          </label>
          <label className="block text-sm font-semibold">Why now?
            <textarea aria-label="Why now" className={area} value={whyNow} onChange={(event) => setWhyNow(event.target.value)} onBlur={() => saveText("screening_why_now", whyNow, deal.screening_why_now)} />
          </label>
          <label className="block text-sm font-semibold">Exit story
            <textarea aria-label="Exit story" className={area} value={exitStory} onChange={(event) => setExitStory(event.target.value)} onBlur={() => saveText("screening_exit_story", exitStory, deal.screening_exit_story)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Missing Data Points
          </CardTitle>
          <CardDescription>Key information needed to complete the analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {missing.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Missing data ${index + 1}`}
                className={line}
                value={item}
                onChange={(event) => setMissing((current) => current.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))}
                onBlur={() => saveLines("screening_missing_data", missing, deal.screening_missing_data)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const next = missing.filter((_, rowIndex) => rowIndex !== index);
                const rows = next.length > 0 ? next : [""];
                setMissing(rows);
                saveLines("screening_missing_data", rows, deal.screening_missing_data);
              }}>Remove</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setMissing((current) => [...current, ""])}>Add point</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Recommended Next Steps
          </CardTitle>
          <CardDescription>Actions to advance this deal forward</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Screening next step ${index + 1}`}
                className={line}
                value={item}
                onChange={(event) => setSteps((current) => current.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))}
                onBlur={() => saveLines("screening_next_steps", steps, deal.screening_next_steps)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const next = steps.filter((_, rowIndex) => rowIndex !== index);
                const rows = next.length > 0 ? next : [""];
                setSteps(rows);
                saveLines("screening_next_steps", rows, deal.screening_next_steps);
              }}>Remove</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setSteps((current) => [...current, ""])}>Add step</Button>
        </CardContent>
      </Card>
    </div>
  );
}
