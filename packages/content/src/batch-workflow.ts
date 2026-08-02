import { ContentBatchSchema, type ContentBatch, type ContentBatchStatus } from '@qingdao/schema';

const ALLOWED_TRANSITIONS: Readonly<Record<ContentBatchStatus, readonly ContentBatchStatus[]>> = {
  draft: ['researching', 'rejected'],
  researching: ['imported', 'rejected'],
  imported: ['validating', 'rejected'],
  validating: ['review-required', 'rejected'],
  'review-required': ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  published: ['rolled-back'],
  rejected: ['draft'],
  'rolled-back': [],
};

export class ContentBatchTransitionError extends Error {
  readonly from: ContentBatchStatus;
  readonly to: ContentBatchStatus;

  constructor(from: ContentBatchStatus, to: ContentBatchStatus, message: string) {
    super(message);
    this.name = 'ContentBatchTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function transitionContentBatch(input: {
  readonly batch: unknown;
  readonly to: ContentBatchStatus;
  readonly now: string;
  readonly reviewer?: string;
  readonly validationSummary?: string;
  readonly releaseVersion?: string;
  readonly rollbackVersion?: string;
}): ContentBatch {
  const batch = ContentBatchSchema.parse(input.batch);
  if (!ALLOWED_TRANSITIONS[batch.status].includes(input.to)) {
    throw new ContentBatchTransitionError(
      batch.status,
      input.to,
      `批次状态不允许从 ${batch.status} 变为 ${input.to}。`,
    );
  }
  const reviewer = input.reviewer?.trim() ?? batch.reviewer;
  if (input.to === 'approved' && (!reviewer || batch.conflicts.length > 0)) {
    throw new ContentBatchTransitionError(
      batch.status,
      input.to,
      '批次通过审核前必须由人工审核人签名且没有未解冲突。',
    );
  }
  if (input.to === 'published' && !input.releaseVersion?.trim()) {
    throw new ContentBatchTransitionError(
      batch.status,
      input.to,
      '发布批次必须指定 releaseVersion。',
    );
  }
  if (input.to === 'rolled-back' && !input.rollbackVersion?.trim()) {
    throw new ContentBatchTransitionError(
      batch.status,
      input.to,
      '回滚批次必须指定 rollbackVersion。',
    );
  }
  return ContentBatchSchema.parse({
    ...batch,
    updatedAt: input.now,
    status: input.to,
    reviewer,
    reviewedAt: input.to === 'approved' ? input.now : batch.reviewedAt,
    validationSummary: input.validationSummary ?? batch.validationSummary,
    releaseVersion: input.releaseVersion ?? batch.releaseVersion,
    rollbackVersion: input.rollbackVersion ?? batch.rollbackVersion,
  });
}

export function allowedBatchTransitions(status: ContentBatchStatus): readonly ContentBatchStatus[] {
  return ALLOWED_TRANSITIONS[status];
}
