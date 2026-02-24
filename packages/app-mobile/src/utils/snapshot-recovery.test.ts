import { ApplicatorError } from "@groundswell/core";
import { courseId, sampleSnapshotResponse, studentId } from "@stu/lib";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { applyEventWithSnapshotRecovery } from "./snapshot-recovery";

describe("applyEventWithSnapshotRecovery", () => {
  it("fetches and applies snapshot once after foreign key failure, then retries apply", async () => {
    const callOrder: string[] = [];
    const applyEvent = vi
      .fn()
      .mockImplementationOnce(() => {
        callOrder.push("applyEvent:initial");
        return Effect.fail({
          _tag: "DatabaseError",
          type: "foreign_key_violation",
          cause: { message: "FOREIGN KEY constraint failed" },
          drizzleError: null,
        });
      })
      .mockImplementationOnce(() => {
        callOrder.push("applyEvent:retry");
        return Effect.void;
      });
    const fetchSnapshot = vi.fn(() => Effect.succeed(sampleSnapshotResponse));
    const applySnapshot = vi.fn((snapshot: typeof sampleSnapshotResponse) => {
      callOrder.push("applySnapshot");
      return Effect.void;
    });

    await Effect.runPromise(
      applyEventWithSnapshotRecovery({
        event: {
          id: "22222222-2222-4222-8222-222222222222",
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          type: "grades.currentGradeSet",
          data: {
            studentId,
            courseId,
            date: new Date("2026-01-01T00:00:00.000Z"),
            result: 2,
            type: "ORAL",
          },
        },
        applyEvent,
        fetchSnapshot,
        applySnapshot,
      }),
    );

    expect(applyEvent).toHaveBeenCalledTimes(2);
    expect(fetchSnapshot).toHaveBeenCalledWith({
      entities: [
        { kind: "student", id: studentId },
        { kind: "course", id: courseId },
      ],
    });
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(applySnapshot).toHaveBeenCalledWith(sampleSnapshotResponse);
    expect(applySnapshot.mock.calls[0]?.[0].tasks).toEqual(sampleSnapshotResponse.tasks);
    expect(callOrder).toEqual(["applyEvent:initial", "applySnapshot", "applyEvent:retry"]);
  });

  it("does not snapshot-recover for non-missing-reference applicator errors", async () => {
    const applyEvent = vi.fn(() => Effect.fail(new ApplicatorError({ cause: "NOT_ALLOWED" })));
    const fetchSnapshot = vi.fn(() => Effect.succeed(sampleSnapshotResponse));

    await expect(
      Effect.runPromise(
        applyEventWithSnapshotRecovery({
          event: {
            id: "33333333-3333-4333-8333-333333333333",
            timestamp: new Date("2026-01-01T00:00:00.000Z"),
            type: "grades.currentGradeSet",
            data: {
              studentId,
              courseId,
              date: new Date("2026-01-01T00:00:00.000Z"),
              result: 2,
              type: "ORAL",
            },
          },
          applyEvent,
          fetchSnapshot,
          applySnapshot: () => Effect.void,
        }),
      ),
    ).rejects.toThrow("NOT_ALLOWED");

    expect(fetchSnapshot).not.toHaveBeenCalled();
  });

  it("recovers when the student row is missing in applicator logic", async () => {
    const applyEvent = vi
      .fn()
      .mockImplementationOnce(() => Effect.fail(new ApplicatorError({ cause: `Student ${studentId} not found` })))
      .mockImplementationOnce(() => Effect.void);
    const fetchSnapshot = vi.fn(() => Effect.succeed(sampleSnapshotResponse));
    const applySnapshot = vi.fn(() => Effect.void);

    await Effect.runPromise(
      applyEventWithSnapshotRecovery({
        event: {
          id: "44444444-4444-4444-8444-444444444444",
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          type: "grades.writtenGradeRecorded",
          data: {
            studentId,
            courseId,
            date: new Date("2026-01-01T00:00:00.000Z"),
            result: 2,
          },
        },
        applyEvent,
        fetchSnapshot,
        applySnapshot,
      }),
    );

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(applyEvent).toHaveBeenCalledTimes(2);
  });
});
