// Fixed for now, per today's design: every pipeline goes through the same
// five stages in this order, regardless of report type.
export const PIPELINE_STAGES = [
  { key: "SOURCE_LOADED", label: "Source loaded" },
  { key: "ENRICHED_SOURCE", label: "Enriched (source)" },
  { key: "ENRICHED_INPUT_FILES", label: "Enriched (input files)" },
  { key: "TAGGING", label: "Tagging" },
  { key: "REPORTS_GENERATED", label: "Reports generated" },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

export const PIPELINE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "AWAITING_INPUT",
  "COMPLETED",
  "FAILED",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export function stageLabel(key: string): string {
  return PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;
}
