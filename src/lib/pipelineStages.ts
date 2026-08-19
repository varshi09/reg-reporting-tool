export const PIPELINE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "AWAITING_INPUT",
  "COMPLETED",
  "FAILED",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
