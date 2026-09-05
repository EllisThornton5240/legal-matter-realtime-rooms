import { z } from "zod";

export const matterIntakeSchema = z.object({
  matterId: z.string().min(1),
  clientId: z.string().min(1),
  practiceArea: z.string().min(1),
});

export const signedDocumentSchema = z.object({
  matterId: z.string().min(1),
  accountId: z.string().min(1),
  documentId: z.string().min(1),
  signedAt: z.string().datetime(),
  downloadUrl: z.string().url(),
});

export const deadlineSchema = z.object({
  matterId: z.string().min(1),
  accountId: z.string().min(1),
  deadlineId: z.string().min(1),
  dueAt: z.string().datetime(),
  now: z.string().datetime(),
});

export type DeadlineInput = z.infer<typeof deadlineSchema>;

export function decideDeadlineFollowUp(input: DeadlineInput) {
  const hoursRemaining = (Date.parse(input.dueAt) - Date.parse(input.now)) / 3_600_000;
  const shouldPublish = hoursRemaining >= 0 && hoursRemaining <= 72;
  return {
    shouldPublish,
    state: shouldPublish ? "follow_up_due" : "scheduled",
    hoursRemaining,
  } as const;
}

export function matterChannel(matterId: string) {
  return `matter:${matterId}`;
}
