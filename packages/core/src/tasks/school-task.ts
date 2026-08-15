import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  ArtifactRef,
  CalendarDate,
  CourseOfferingId,
  NonEmptyText,
  Revision,
  SchoolMembershipId,
  SchoolTaskId,
} from "../foundation";
import { ActorRef } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";

export const TaskStatus = Schema.TaggedUnion({
  Open: {},
  Completed: { completedOn: CalendarDate },
  Cancelled: {
    cancelledOn: CalendarDate,
    reason: Schema.optionalKey(NonEmptyText),
  },
});
export type TaskStatus = typeof TaskStatus.Type;

export const SchoolTask = Schema.Struct({
  id: SchoolTaskId,
  studentMembershipId: SchoolMembershipId,
  revision: Revision,
  title: NonEmptyText,
  description: Schema.optionalKey(NonEmptyText),
  dueDate: CalendarDate,
  courseOfferingId: Schema.optionalKey(CourseOfferingId),
  attachments: Schema.Array(ArtifactRef),
  status: TaskStatus,
});
export interface SchoolTask extends Schema.Schema.Type<typeof SchoolTask> {}

export const DueStatus = Schema.Literals(["Upcoming", "DueToday", "Overdue"]);
export type DueStatus = typeof DueStatus.Type;

export const dueStatus = (task: SchoolTask, today: CalendarDate): DueStatus =>
  task.dueDate < today ? "Overdue" : task.dueDate === today ? "DueToday" : "Upcoming";

const TaskTransition = Schema.Literals(["Complete", "Reopen", "Cancel"]);
const TaskStatusTag = Schema.Literals(["Open", "Completed", "Cancelled"]);

export class TaskTransitionRefused extends Schema.TaggedError<TaskTransitionRefused>()(
  "Tasks.TaskTransitionRefused",
  {
    taskId: SchoolTaskId,
    transition: TaskTransition,
    currentStatus: TaskStatusTag,
  },
) {
  override get message(): string {
    return `Cannot ${this.transition.toLowerCase()} task ${this.taskId} while it is ${this.currentStatus.toLowerCase()}`;
  }
}

export class ConcurrentTaskRevision extends Schema.TaggedError<ConcurrentTaskRevision>()(
  "Tasks.ConcurrentRevision",
  { taskId: SchoolTaskId, expected: Revision, actual: Revision },
) {}

export const TransitionError = Schema.Union([
  TaskTransitionRefused,
  ConcurrentTaskRevision,
  AuthorityDenied,
]);
export type TransitionError = typeof TransitionError.Type;

interface TransitionInput {
  readonly task: SchoolTask;
  readonly expectedRevision: Revision;
  readonly actor: ActorRef;
  readonly authority: AuthoritySnapshot;
  readonly on: CalendarDate;
}

const refuse = (task: SchoolTask, transition: typeof TaskTransition.Type) =>
  Effect.fail(
    new TaskTransitionRefused({
      taskId: task.id,
      transition,
      currentStatus: task.status._tag,
    }),
  );

const withStatus = (task: SchoolTask, status: TaskStatus): SchoolTask =>
  SchoolTask.make(Object.assign({}, task, { revision: Revision.make(task.revision + 1), status }));

const prepare = (input: TransitionInput) =>
  Effect.gen(function* () {
    if (input.task.revision !== input.expectedRevision) {
      return yield* new ConcurrentTaskRevision({
        taskId: input.task.id,
        expected: input.expectedRevision,
        actual: input.task.revision,
      });
    }
    yield* authorize(
      input.actor,
      Capability.cases.ManageOwnNotebook.make({
        studentMembershipId: input.task.studentMembershipId,
      }),
      input.on,
      input.authority,
    );
  });

export const complete = Effect.fn("SchoolTask.complete")(function* (
  input: complete.Input,
  completedOn: CalendarDate,
) {
  yield* prepare(input);
  if (input.task.status._tag !== "Open") return yield* refuse(input.task, "Complete");

  return withStatus(input.task, TaskStatus.cases.Completed.make({ completedOn }));
});

export declare namespace complete {
  export type Input = TransitionInput;
  export type Error = TransitionError;
}

export const reopen = Effect.fn("SchoolTask.reopen")(function* (input: reopen.Input) {
  yield* prepare(input);
  if (input.task.status._tag === "Open") return yield* refuse(input.task, "Reopen");

  return withStatus(input.task, TaskStatus.cases.Open.make({}));
});

export declare namespace reopen {
  export type Input = TransitionInput;
  export type Error = TransitionError;
}

export const cancel = Effect.fn("SchoolTask.cancel")(function* (
  input: cancel.Input,
  cancelledOn: CalendarDate,
  reason?: NonEmptyText,
) {
  yield* prepare(input);
  if (input.task.status._tag !== "Open") return yield* refuse(input.task, "Cancel");

  return withStatus(
    input.task,
    reason === undefined
      ? TaskStatus.cases.Cancelled.make({ cancelledOn })
      : TaskStatus.cases.Cancelled.make({ cancelledOn, reason }),
  );
});

export declare namespace cancel {
  export type Input = TransitionInput;
  export type Error = TransitionError;
}
