import { describe, it, expect } from "vitest";
import {
  evaluateJobStatus,
  evaluateSanity,
  decideContinue,
  type SanitySummary,
} from "../autoSubmissionGate";

const full: SanitySummary = {
  avatar_healthy: 6, avatar_total: 6,
  topic_healthy: 3, topic_total: 3,
  images_healthy: 4, images_total: 4,
};

describe("evaluateJobStatus", () => {
  it("proceeds only on 'completed'", () => {
    expect(evaluateJobStatus("completed").proceed).toBe(true);
  });
  it("stops on completed_with_errors", () => {
    expect(evaluateJobStatus("completed_with_errors").proceed).toBe(false);
  });
  it("stops on failed", () => {
    expect(evaluateJobStatus("failed").proceed).toBe(false);
  });
  it("stops on processing", () => {
    expect(evaluateJobStatus("processing").proceed).toBe(false);
  });
  it("stops on empty string", () => {
    expect(evaluateJobStatus("").proceed).toBe(false);
  });
  it("stops on undefined", () => {
    expect(evaluateJobStatus(undefined).proceed).toBe(false);
  });
});

describe("evaluateSanity", () => {
  it("passes on full healthy summary", () => {
    expect(evaluateSanity(full).passed).toBe(true);
  });
  it("fails on avatar 5/6", () => {
    const r = evaluateSanity({ ...full, avatar_healthy: 5 });
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/Avatar/);
  });
  it("fails on topic 2/3", () => {
    const r = evaluateSanity({ ...full, topic_healthy: 2 });
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/Topic/);
  });
  it("fails on images 3/4", () => {
    const r = evaluateSanity({ ...full, images_healthy: 3 });
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/Images/);
  });
  it("fails when totals are all zero (overall 0)", () => {
    const r = evaluateSanity({
      avatar_healthy: 0, avatar_total: 0,
      topic_healthy: 0, topic_total: 0,
      images_healthy: 0, images_total: 0,
    });
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/Overall/);
  });
  it("fails on null summary", () => {
    expect(evaluateSanity(null).passed).toBe(false);
  });
  it("fails on undefined summary", () => {
    expect(evaluateSanity(undefined).passed).toBe(false);
  });
});

describe("3-job queue simulation", () => {
  it("stops at job 2 with avatar 5/6 and never reaches job 3", async () => {
    const jobs = [
      { status: "completed", summary: full },
      { status: "completed", summary: { ...full, avatar_healthy: 5 } },
      { status: "completed", summary: full },
    ];
    let processed = 0;
    let lastReason: string | undefined;
    for (const j of jobs) {
      processed++;
      const d = decideContinue(j.status, j.summary);
      if (!d.continue) {
        lastReason = d.reason;
        break;
      }
    }
    expect(processed).toBe(2);
    expect(lastReason).toMatch(/Avatar/);
  });
});
