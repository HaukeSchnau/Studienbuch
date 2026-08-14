import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ActorRef, AuthoritySnapshot, SchoolMembership, StudentMembership } from "../../src/people";
import {
  ArtifactId,
  CalendarDate,
  CourseOfferingId,
  DateInterval,
  NonEmptyText,
  PersonId,
  Revision,
  SchoolId,
  SchoolMembershipId,
  SchoolTaskId,
  TrimmedNonEmptyString,
} from "../../src/primitives";
import {
  cancelTask,
  completeTask,
  defaultTaskVisibilityPolicy,
  getTaskDueStatus,
  isTaskArchived,
  reopenTask,
  SchoolTask,
  selectArchivedTasks,
  selectTasksForCourse,
  selectTasksWithoutCourse,
  selectVisibleTasks,
  TaskStatus,
  TaskVisibilityPolicy,
} from "../../src/tasks";

const date = (value: string) => CalendarDate.make(value);
const taskId = (value: string) => SchoolTaskId.make(value);
const title = (value: string) => NonEmptyText.make(value);
const courseId = (value: string) => CourseOfferingId.make(value);
const studentMembershipId = SchoolMembershipId.make("student-membership");
const studentPersonId = PersonId.make("student-person");
const effective = DateInterval.make({ start: date("2026-01-01"), end: date("2026-12-31") });
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

const transition = (task: SchoolTask) => ({
  task,
  expectedRevision: task.revision,
  actor,
  authority,
  on: date("2026-03-29"),
});

const makeTask = (overrides: Partial<SchoolTask> = {}): SchoolTask =>
  SchoolTask.make({
    id: taskId("task-1"),
    studentMembershipId,
    revision: Revision.make(0),
    title: title("Read chapter 4"),
    dueDate: date("2026-03-29"),
    attachments: [],
    status: TaskStatus.cases.Open.make({}),
    ...overrides,
  });

describe("SchoolTask schema", () => {
  it.effect("supports tasks without a course and validates artifact references", () =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeEffect(SchoolTask)({
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
            digest: "sha256:abc",
          },
        ],
        status: { _tag: "Open" },
      });

      expect(decoded.courseOfferingId).toBeUndefined();
      expect(decoded.attachments).toEqual([
        {
          id: ArtifactId.make("artifact-1"),
          mediaType: TrimmedNonEmptyString.make("image/jpeg"),
          digest: TrimmedNonEmptyString.make("sha256:abc"),
        },
      ]);
      const attachment = decoded.attachments[0];
      if (attachment === undefined) return yield* Effect.die("Expected a decoded attachment");
      expect("uri" in attachment).toBe(false);
    }),
  );
});

describe("task date policies", () => {
  it("classifies due dates using calendar dates only", () => {
    const task = makeTask();

    expect(getTaskDueStatus(task, date("2026-03-28"))).toBe("Upcoming");
    expect(getTaskDueStatus(task, date("2026-03-29"))).toBe("DueToday");
    expect(getTaskDueStatus(task, date("2026-03-30"))).toBe("Overdue");
  });

  it("keeps an overdue task visible through the exact seven-day threshold", () => {
    const task = makeTask({ dueDate: date("2026-03-22") });

    expect(isTaskArchived(task, date("2026-03-29"))).toBe(false);
    expect(isTaskArchived(task, date("2026-03-30"))).toBe(true);
  });

  it("uses DST-independent calendar arithmetic across the spring transition", () => {
    const task = makeTask({ dueDate: date("2026-03-24") });

    expect(isTaskArchived(task, date("2026-03-31"))).toBe(false);
    expect(isTaskArchived(task, date("2026-04-01"))).toBe(true);
  });

  it("allows visibility to be configured without changing task state", () => {
    const completed = makeTask({
      status: TaskStatus.cases.Completed.make({ completedOn: date("2026-03-20") }),
    });
    const policy = TaskVisibilityPolicy.make({
      archiveCompleted: false,
      archiveCancelled: defaultTaskVisibilityPolicy.archiveCancelled,
      archiveOpenTasksAfterOverdueDays: 30,
    });

    expect(completed.status._tag).toBe("Completed");
    expect(policy.archiveCompleted).toBe(false);
    expect(isTaskArchived(completed, date("2026-04-01"), policy)).toBe(false);
    expect(completed.status._tag).toBe("Completed");
  });
});

describe("task lifecycle", () => {
  it.effect("completes, reopens, and cancels with caller-supplied dates", () =>
    Effect.gen(function* () {
      const original = makeTask();
      const completed = yield* completeTask(transition(original), date("2026-03-28"));
      const reopened = yield* reopenTask(transition(completed));
      const cancelled = yield* cancelTask(
        transition(reopened),
        date("2026-03-29"),
        title("No longer assigned"),
      );

      expect(original.status._tag).toBe("Open");
      expect(completed.status).toEqual({ _tag: "Completed", completedOn: "2026-03-28" });
      expect(reopened.status).toEqual({ _tag: "Open" });
      expect(cancelled.status).toEqual({
        _tag: "Cancelled",
        cancelledOn: "2026-03-29",
        reason: "No longer assigned",
      });
      const cancelledWithoutReason = yield* cancelTask(
        transition(makeTask({ id: taskId("without-reason") })),
        date("2026-03-29"),
      );
      expect(cancelledWithoutReason.status).toEqual({
        _tag: "Cancelled",
        cancelledOn: "2026-03-29",
      });
    }),
  );

  it.effect("rejects a stale task transition", () =>
    Effect.gen(function* () {
      const task = makeTask({ revision: Revision.make(2) });
      const failure = yield* completeTask(
        { ...transition(task), expectedRevision: Revision.make(1) },
        date("2026-03-29"),
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "Tasks.ConcurrentRevision", actual: 2, expected: 1 });
    }),
  );

  it.effect("returns a typed refusal for invalid transitions", () =>
    Effect.gen(function* () {
      const completed = makeTask({
        status: TaskStatus.cases.Completed.make({ completedOn: date("2026-03-28") }),
      });
      const completeRefusal = yield* completeTask(transition(completed), date("2026-03-29")).pipe(
        Effect.flip,
      );
      const cancelRefusal = yield* cancelTask(transition(completed), date("2026-03-29")).pipe(
        Effect.flip,
      );
      const open = makeTask();
      const reopenRefusal = yield* reopenTask(transition(open)).pipe(Effect.flip);

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
      status: TaskStatus.cases.Completed.make({ completedOn: date("2026-04-01") }),
    }),
    makeTask({ id: taskId("old"), title: title("Old"), dueDate: date("2026-03-01") }),
  ] as const;

  it("selects course-bound and unassigned tasks without mutating the input", () => {
    const originalOrder = tasks.map((task) => task.id);

    expect(selectTasksForCourse(tasks, german).map((task) => task.id)).toEqual(["course"]);
    expect(selectTasksWithoutCourse(tasks).map((task) => task.id)).toEqual([
      "old",
      "later",
      "completed",
    ]);
    expect(tasks.map((task) => task.id)).toEqual(originalOrder);
  });

  it("deterministically partitions visible and archived tasks", () => {
    const today = date("2026-04-10");

    expect(selectVisibleTasks(tasks, today).map((task) => task.id)).toEqual(["course", "later"]);
    expect(selectArchivedTasks(tasks, today).map((task) => task.id)).toEqual(["old", "completed"]);
  });
});
