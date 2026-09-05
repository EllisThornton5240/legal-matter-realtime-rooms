import { describe, expect, it } from "vitest";
import { decideDeadlineFollowUp } from "../src/legal_workflow.ts";

describe("deadline follow-up decision", () => {
  it("publishes when a filing deadline is within 72 hours", () => {
    const decision = decideDeadlineFollowUp({
      matterId: "matter-1042",
      accountId: "firm-9",
      deadlineId: "filing-22",
      now: "2026-09-02T09:00:00.000Z",
      dueAt: "2026-09-05T08:00:00.000Z",
    });

    expect(decision).toEqual({
      shouldPublish: true,
      state: "follow_up_due",
      hoursRemaining: 71,
    });
  });

  it("keeps a later deadline scheduled", () => {
    const decision = decideDeadlineFollowUp({
      matterId: "matter-1042",
      accountId: "firm-9",
      deadlineId: "filing-23",
      now: "2026-09-02T09:00:00.000Z",
      dueAt: "2026-09-08T09:00:00.000Z",
    });

    expect(decision.state).toBe("scheduled");
    expect(decision.shouldPublish).toBe(false);
  });
});
