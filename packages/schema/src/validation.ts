import type { z } from 'zod';

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

function issuePath(path: PropertyKey[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`;
    return `${result}.${String(segment)}`;
  }, '$');
}

export function validationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issuePath(issue.path),
    code: issue.code,
    message: issue.message,
  }));
}

export function formatValidationError(error: z.ZodError): string {
  return validationIssues(error)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('\n');
}
