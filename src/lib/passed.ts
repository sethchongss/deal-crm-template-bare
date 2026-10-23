import type { DealStage } from "@/types/database";
import { STAGE_CONFIG } from "@/lib/constants";

/** Stage shown to people. The old 'Passed' stage value is not a real process stage. */
export function displayStage(stage: string | null | undefined): DealStage {
  if (!stage || stage === "Passed") return "Screening/Pipeline";
  return stage as DealStage;
}

export function passedAtLabel(stage: string | null | undefined) {
  return `Passed at ${displayStage(stage)}`;
}

export function stageTone(stage: string | null | undefined) {
  return STAGE_CONFIG[displayStage(stage)].tone;
}
