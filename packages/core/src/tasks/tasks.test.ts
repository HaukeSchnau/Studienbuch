import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as AggregateRevision from "../foundation/aggregate-revision.ts";
import * as Artifact from "../foundation/artifact.ts";
import * as CalendarDate from "../foundation/calendar-date.ts";
import * as CalendarDateRange from "../foundation/calendar-date-range.ts";
import * as NonBlankText from "../foundation/non-blank-text.ts";
import { ActorRef } from "../organization/acknowledgement.ts";
import { AuthoritySnapshot } from "../organization/authority.ts";
import {
  CourseOfferingId,
  PersonId,
  SchoolId,
  SchoolMembershipId,
} from "../organization/identity.ts";
import { SchoolMembership, StudentMembership } from "../organization/membership.ts";
import { SchoolTaskId } from "./identity.ts";
import * as Tasks from "./index.ts";

const date = CalendarDate.unsafeFromString;
const taskId = (value: string) => SchoolTaskId.make(value);
const title = (value: string) => NonBlankText.Schema.make(value);
const courseId = (value: string) => CourseOfferingId.make(value);
const studentMembershipId = SchoolMembershipId.make("student-membership");
const studentPersonId = PersonId.make("student-person");
const effective = CalendarDateRange.Schema.make({
  start: date("2026-01-01"),
  end: date("2026-12-31"),
});
const actor = ActorRef.make({ personId: studentPersonId, schoolMembershipId: studentMembershipId });
const authority = AuthoritySnapshot.make({
  memberships: [
    SchoolMembership.make({
      id: studentMembershipId,
      schoolId: SchoolId.make("school"),
      personId: studentPersonId,
      roles: ["Student"],
      effective,
    }),
  ],
  students: [StudentMembership.make({ membershipId: studentMembershipId, classGroupIds: [] })],
  guardianRelationships: [],
  teachingAssignments: [],
  courseOfferings: [],
});

const transition = (task: Tasks.SchoolTask) => ({
  task,
  expectedRevision: task.revision,
  actor,
  authority,
  on: date("2026-03-29"),
});

const makeTask = (overrides: Partial<Tasks.SchoolTask> = {}): Tasks.SchoolTask =>
  Tasks.SchoolTask.make({
    id: taskId("task-1"),
    studentMembershipId,
    revision: AggregateRevision.initial,
    title: title("Read chapter 4"),
    dueDate: date("2026-03-29"),
    attachments: [],
    status: Tasks.TaskStatus.cases.Open.make({}),
    ...overrides,
  });

describe("SchoolTask schema", () => {
  it.effect("round-trips a nested task without a course and validates artifact references", () =>
    Effect.gen(function* () {
      const encoded: typeof Tasks.SchoolTask.Encoded = {
        id: "task-1",
        studentMembershipId: "student-membership",
        revision: 0,
        title: "Read chapter 4",
        description: "Prepare questions",
        dueDate: "2026-03-29",
        attachments: [
          {
            id: "artifact-1",
            mediaType: "image/jpeg",
            contentDigest: { algorithm: "sha256", value: "abc" },
          },
        ],
        status: { _tag: "Open" },
      };
      const decoded = yield* Schema.decodeEffect(Tasks.SchoolTask)(encoded);

      expect(decoded.courseOfferingId).toBeUndefined();
      expect(decoded.attachments).toEqual([
        {
          id: Artifact.Id.make("artifact-1"),
          mediaType: Artifact.MediaType.make("image/jpeg"),
          contentDigest: { algorithm: "sha256", value: "abc" },
        },
      ]);
      const attachment = decoded.attachments[0];
      if (attachment === undefined) return yield* Effect.die("Expected a decoded attachment");
      expect("uri" in attachment).toBe(false);
      expect(CalendarDate.toString(decoded.dueDate)).toBe("2026-03-29");
      expect(yield* Schema.encodeEffect(Tasks.SchoolTask)(decoded)).toEqual(encoded);
    }),
  );
});

describe("task date policies", () => {
  it("classifies due dates using calendar dates only", () => {
    const task = makeTask();

    expect(Tasks.dueStatus(task, date("2026-03-28"))).toBe("Upcoming");
    expect(Tasks.dueStatus(task, date("2026-03-29"))).toBe("DueToday");
    expect(Tasks.dueStatus(task, date("2026-03-30"))).toBe("Overdue");
  });

  it("keeps an overdue task visible through the exact seven-day threshold", () => {
    const task = makeTask({ dueDate: date("2026-03-22") });

    expect(Tasks.isArchived(task, date("2026-03-29"))).toBe(false);
    expect(Tasks.isArchived(task, date("2026-03-30"))).toBe(true);
  });

  it("uses DST-independent calendar arithmetic across the spring transition", () => {
    const task = makeTask({ dueDate: date("2026-03-24") });

    expect(Tasks.isArchived(task, date("2026-03-31"))).toBe(false);
    expect(Tasks.isArchived(task, date("2026-04-01"))).toBe(true);
  });

  it("allows visibility to be configured without changing task state", () => {
    const completed = makeTask({
      status: Tasks.TaskStatus.cases.Completed.make({ completedOn: date("2026-03-20") }),
    });
    const policy = Tasks.VisibilityPolicy.make({
      archiveCompleted: false,
      archiveCancelled: Tasks.defaultVisibilityPolicy.archiveCancelled,
      archiveOpenTasksAfterOverdueDays: 30,
    });

    expect(completed.status._tag).toBe("Completed");
    expect(policy.archiveCompleted).toBe(false);
    expect(Tasks.isArchived(completed, date("2026-04-01"), policy)).toBe(false);
    expect(completed.status._tag).toBe("Completed");
  });
});

describe("task lifecycle", () => {
  it.effect("completes, reopens, and cancels with caller-supplied dates", () =>
    Effect.gen(function* () {
      const original = makeTask();
      const completed = yield* Tasks.complete(transition(original), date("2026-03-28"));
      const reopened = yield* Tasks.reopen(transition(completed));
      const cancelled = yield* Tasks.cancel(
        transition(reopened),
        date("2026-03-29"),
        title("No longer assigned"),
      );

      expect(original.status._tag).toBe("Open");
      expect(completed.status._tag).toBe("Completed");
      if (completed.status._tag === "Completed") {
        expect(CalendarDate.toString(completed.status.completedOn)).toBe("2026-03-28");
      }
      expect(reopened.status).toEqual({ _tag: "Open" });
      expect(cancelled.status._tag).toBe("Cancelled");
      if (cancelled.status._tag === "Cancelled") {
        expect(CalendarDate.toString(cancelled.status.cancelledOn)).toBe("2026-03-29");
        expect(cancelled.status.reason).toBe("No longer assigned");
      }
      const cancelledWithoutReason = yield* Tasks.cancel(
        transition(makeTask({ id: taskId("without-reason") })),
        date("2026-03-29"),
      );
      expect(cancelledWithoutReason.status._tag).toBe("Cancelled");
      if (cancelledWithoutReason.status._tag === "Cancelled") {
        expect(CalendarDate.toString(cancelledWithoutReason.status.cancelledOn)).toBe("2026-03-29");
        expect(cancelledWithoutReason.status.reason).toBeUndefined();
      }
    }),
  );

  it.effect("rejects a stale task transition", () =>
    Effect.gen(function* () {
      const task = makeTask({ revision: AggregateRevision.Schema.make(2) });
      const failure = yield* Tasks.complete(
        { ...transition(task), expectedRevision: AggregateRevision.Schema.make(1) },
        date("2026-03-29"),
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "Tasks.ConcurrentRevision", actual: 2, expected: 1 });
    }),
  );

  it.effect("returns a typed refusal for invalid transitions", () =>
    Effect.gen(function* () {
      const completed = makeTask({
        status: Tasks.TaskStatus.cases.Completed.make({ completedOn: date("2026-03-28") }),
      });
      const completeRefusal = yield* Tasks.complete(transition(completed), date("2026-03-29")).pipe(
        Effect.flip,
      );
      const cancelRefusal = yield* Tasks.cancel(transition(completed), date("2026-03-29")).pipe(
        Effect.flip,
      );
      const open = makeTask();
      const reopenRefusal = yield* Tasks.reopen(transition(open)).pipe(Effect.flip);

      expect(completeRefusal).toMatchObject({
        _tag: "Tasks.TaskTransitionRefused",
        transition: "Complete",
        currentStatus: "Completed",
      });
      expect(cancelRefusal).toMatchObject({ transition: "Cancel", currentStatus: "Completed" });
      expect(reopenRefusal).toMatchObject({ transition: "Reopen", currentStatus: "Open" });
    }),
  );
});

describe("task selectors", () => {
  const german = courseId("de-1");
  const tasks = [
    makeTask({ id: taskId("later"), title: title("Later"), dueDate: date("2026-04-20") }),
    makeTask({
      id: taskId("course"),
      title: title("Course work"),
      dueDate: date("2026-04-10"),
      courseOfferingId: german,
    }),
    makeTask({
      id: taskId("completed"),
      title: title("Completed"),
      dueDate: date("2026-04-01"),
      status: Tasks.TaskStatus.cases.Completed.make({ completedOn: date("2026-04-01") }),
    }),
    makeTask({ id: taskId("old"), title: title("Old"), dueDate: date("2026-03-01") }),
  ] as const;

  it("selects course-bound and unassigned tasks without mutating the input", () => {
    const originalOrder = tasks.map((task) => task.id);

    expect(Tasks.selectForCourse(tasks, german).map((task) => task.id)).toEqual(["course"]);
    expect(Tasks.selectWithoutCourse(tasks).map((task) => task.id)).toEqual([
      "old",
      "later",
      "completed",
    ]);
    expect(tasks.map((task) => task.id)).toEqual(originalOrder);
  });

  it("deterministically partitions visible and archived tasks", () => {
    const today = date("2026-04-10");

    expect(Tasks.selectVisible(tasks, today).map((task) => task.id)).toEqual(["course", "later"]);
    expect(Tasks.selectArchived(tasks, today).map((task) => task.id)).toEqual(["old", "completed"]);
  });

  it("sorts equal, separately-created dates deterministically", () => {
    const equalDateA = date("2026-04-10");
    const equalDateB = date("2026-04-10");
    expect(equalDateA).not.toBe(equalDateB);
    expect(CalendarDate.Equivalence(equalDateA, equalDateB)).toBe(true);

    const sameDay = [
      makeTask({ id: taskId("z"), title: title("Zulu"), dueDate: equalDateA }),
      makeTask({ id: taskId("a"), title: title("Alpha"), dueDate: equalDateB }),
    ];

    expect(Tasks.sort(sameDay).map((task) => task.id)).toEqual(["a", "z"]);
  });
});
