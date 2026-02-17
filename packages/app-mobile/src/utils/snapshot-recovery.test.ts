import { ApplicatorError } from "@groundswell/core";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { applyEventWithSnapshotRecovery, snapshotEntitiesForEvent } from "./snapshot-recovery";

const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const courseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const validSnapshot = {
  students: [
    {
      id: studentId,
      firstName: "Ada",
      lastName: "Student",
      isOfAge: false,
      school: {
        id: "igs-lil" as const,
        name: "IGS Lilienthal",
        stateCode: "NI" as const,
      },
      year: {
        name: "11",
        startYear: 2024,
        graduationYear: 2027,
        school: "igs-lil" as const,
      },
      class: {
        identifierInYear: "11a",
        startYear: 2024,
        school: "igs-lil" as const,
      },
    },
  ],
  courses: [
    {
      id: courseId,
      name: "Mathe LK",
      subject: "ma" as const,
      isMandatory: false,
      school: {
        id: "igs-lil" as const,
        name: "IGS Lilienthal",
        stateCode: "NI" as const,
      },
      semester: {
        name: "Winter 2025/2026",
        start: "2025-08-01T00:00:00.000Z",
        end: "2026-01-31T23:59:59.000Z",
        school: "igs-lil" as const,
        type: "WINTER" as const,
        year: 2025,
      },
      teachers: [],
      classes: [],
    },
  ],
  absences: [],
  grades: [],
};

describe("snapshotEntitiesForEvent", () => {
  it("returns student + deduplicated course refs for absence.recorded", () => {
    const refs = snapshotEntitiesForEvent({
      id: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      type: "absence.recorded",
      data: {
        studentId,
        date: new Date("2026-01-01T00:00:00.000Z"),
        reason: "Krank",
        courseIds: [courseId, courseId],
      },
    });

    expect(refs).toEqual([
      { kind: "student", id: studentId },
      { kind: "course", id: courseId },
    ]);
  });

  it("returns only student ref for student.joined", () => {
    const refs = snapshotEntitiesForEvent({
      id: "99999999-9999-4999-8999-999999999999",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      type: "student.joined",
      data: {
        studentId,
        name: "Ada Student",
        school: "igs-lil",
        isOfAge: false,
        class: {
          identifier: "11a",
          startYear: 2024,
        },
      },
    });

    expect(refs).toEqual([{ kind: "student", id: studentId }]);
  });
});

describe("applyEventWithSnapshotRecovery", () => {
  it("fetches and applies snapshot once after foreign key failure, then retries apply", async () => {
    const applyEvent = vi
      .fn()
      .mockImplementationOnce(() =>
        Effect.fail({
          _tag: "DatabaseError",
          type: "foreign_key_violation",
          cause: { message: "FOREIGN KEY constraint failed" },
          drizzleError: null,
        }),
      )
      .mockImplementationOnce(() => Effect.void);
    const fetchSnapshot = vi.fn(() => Effect.succeed(validSnapshot));
    const applySnapshot = vi.fn(() => Effect.void);

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
  });

  it("does not snapshot-recover for non-missing-reference applicator errors", async () => {
    const applyEvent = vi.fn(() => Effect.fail(new ApplicatorError({ cause: "NOT_ALLOWED" })));
    const fetchSnapshot = vi.fn(() => Effect.succeed(validSnapshot));

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
    const fetchSnapshot = vi.fn(() => Effect.succeed(validSnapshot));
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
