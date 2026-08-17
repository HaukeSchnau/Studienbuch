import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { Artifact } from "../foundation/artifact";
import { PlainDateSchema } from "../foundation/plain-date";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { NonBlankText } from "../foundation/non-blank-text";
import { ActorRef } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import { SchoolTaskId } from "./identity";

export const TaskStatus = Schema.TaggedUnion({
  Open: {},
  Completed: { completedOn: PlainDateSchema },
  Cancelled: {
    cancelledOn: PlainDateSchema,
    reason: Schema.optionalKey(NonBlankText.Schema),
  },
});
export type TaskStatus = typeof TaskStatus.Type;

export const SchoolTask = Schema.Struct({
  id: SchoolTaskId,
  studentMembershipId: SchoolMembershipId,
  revision: AggregateRevision.Schema,
  title: NonBlankText.Schema,
  description: Schema.optionalKey(NonBlankText.Schema),
  dueDate: PlainDateSchema,
  courseOfferingId: Schema.optionalKey(CourseOfferingId),
  attachments: Schema.Array(Artifact.Reference),
  status: TaskStatus,
});
export interface SchoolTask extends Schema.Schema.Type<typeof SchoolTask> {}

export const DueStatus = Schema.Literals(["Upcoming", "DueToday", "Overdue"]);
export type DueStatus = typeof DueStatus.Type;

export const dueStatus = (task: SchoolTask, today: PlainDate.Record): DueStatus => {
  const order = PlainDate.compare(task.dueDate, today);
  return order < 0 ? "Overdue" : order === 0 ? "DueToday" : "Upcoming";
};

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
  {
    taskId: SchoolTaskId,
    expected: AggregateRevision.Schema,
    actual: AggregateRevision.Schema,
  },
) {}

export const TransitionError = Schema.Union([
  TaskTransitionRefused,
  ConcurrentTaskRevision,
  AggregateRevision.Exhausted,
  AuthorityDenied,
]);
export type TransitionError = typeof TransitionError.Type;

interface TransitionInput {
  readonly task: SchoolTask;
  readonly expectedRevision: AggregateRevision.Type;
  readonly actor: ActorRef;
  readonly authority: AuthoritySnapshot;
  readonly on: PlainDate.Record;
}

const refuse = (task: SchoolTask, transition: typeof TaskTransition.Type) =>
  Effect.fail(
    new TaskTransitionRefused({
      taskId: task.id,
      transition,
      currentStatus: task.status._tag,
    }),
  );

const withStatus = Effect.fn("SchoolTask.withStatus")(function* (
  task: SchoolTask,
  status: TaskStatus,
) {
  const revision = yield* AggregateRevision.next(task.revision);
  return SchoolTask.make(Object.assign({}, task, { revision, status }));
});

const prepare = (input: TransitionInput) =>
  Effect.gen(function* () {
    if (!AggregateRevision.Equivalence(input.task.revision, input.expectedRevision)) {
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
  completedOn: PlainDate.Record,
) {
  yield* prepare(input);
  if (input.task.status._tag !== "Open") return yield* refuse(input.task, "Complete");

  return yield* withStatus(input.task, TaskStatus.cases.Completed.make({ completedOn }));
});

export declare namespace complete {
  export type Input = TransitionInput;
  export type Error = TransitionError;
}

export const reopen = Effect.fn("SchoolTask.reopen")(function* (input: reopen.Input) {
  yield* prepare(input);
  if (input.task.status._tag === "Open") return yield* refuse(input.task, "Reopen");

  return yield* withStatus(input.task, TaskStatus.cases.Open.make({}));
});

export declare namespace reopen {
  export type Input = TransitionInput;
  export type Error = TransitionError;
}

export const cancel = Effect.fn("SchoolTask.cancel")(function* (
  input: cancel.Input,
  cancelledOn: PlainDate.Record,
  reason?: NonBlankText.Type,
) {
  yield* prepare(input);
  if (input.task.status._tag !== "Open") return yield* refuse(input.task, "Cancel");

  return yield* withStatus(
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
