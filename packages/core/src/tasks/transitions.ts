import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AuthorityDenied, AuthoritySnapshot, Capability, authorize } from "../people/authority";
import { ActorRef } from "../people/model";
import { Revision } from "../primitives";
import { SchoolTaskId } from "../primitives/ids";
import { CalendarDate } from "../primitives/time";
import { NonEmptyText } from "../primitives/values";
import { SchoolTask, TaskStatus } from "./model";

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

export const TaskTransitionError = Schema.Union([
  TaskTransitionRefused,
  ConcurrentTaskRevision,
  AuthorityDenied,
]);
export type TaskTransitionError = typeof TaskTransitionError.Type;

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

export interface TaskTransitionInput {
  readonly task: SchoolTask;
  readonly expectedRevision: Revision;
  readonly actor: ActorRef;
  readonly authority: AuthoritySnapshot;
  readonly on: CalendarDate;
}

const prepare = (input: TaskTransitionInput) =>
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

export const completeTask = Effect.fn("SchoolTask.complete")(function* (
  input: TaskTransitionInput,
  completedOn: CalendarDate,
) {
  yield* prepare(input);
  if (input.task.status._tag !== "Open") return yield* refuse(input.task, "Complete");

  return withStatus(input.task, TaskStatus.cases.Completed.make({ completedOn }));
});

export const reopenTask = Effect.fn("SchoolTask.reopen")(function* (input: TaskTransitionInput) {
  yield* prepare(input);
  if (input.task.status._tag === "Open") return yield* refuse(input.task, "Reopen");

  return withStatus(input.task, TaskStatus.cases.Open.make({}));
});

export const cancelTask = Effect.fn("SchoolTask.cancel")(function* (
  input: TaskTransitionInput,
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
