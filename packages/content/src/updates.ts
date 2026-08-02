import {
  ContentUpdateRunSchema,
  type ContentUpdateJob,
  type ContentUpdateRun,
} from '@qingdao/schema';

export function dueContentUpdateJobs(
  jobs: readonly ContentUpdateJob[],
  now: string,
): ContentUpdateJob[] {
  const current = Date.parse(now);
  return jobs.filter((job) => job.enabled && Date.parse(job.nextCheckAt) <= current);
}

export function recordContentUpdateResult(input: {
  readonly job: ContentUpdateJob;
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly changedEntityIds: readonly string[];
  readonly proposedBatchId?: string | null;
  readonly summary: string;
  readonly errorMessage?: string;
}): ContentUpdateRun {
  const failed = Boolean(input.errorMessage);
  const changed = input.changedEntityIds.length > 0;
  if (changed && !input.proposedBatchId) {
    throw new Error('内容变化必须进入 proposedBatchId，不能绕过人工审核。');
  }
  return ContentUpdateRunSchema.parse({
    schemaVersion: 1,
    createdAt: input.startedAt,
    updatedAt: input.completedAt,
    id: input.runId,
    jobId: input.job.id,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    status: failed ? 'failed' : changed ? 'review-required' : 'no-change',
    observedEntityIds: [...input.changedEntityIds],
    proposedBatchId: input.proposedBatchId ?? null,
    summary: input.summary,
    errorMessage: input.errorMessage ?? '',
  });
}
