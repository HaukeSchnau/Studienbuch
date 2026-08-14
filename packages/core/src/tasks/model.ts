import * as Schema from "effect/Schema";
import { CourseOfferingId, SchoolMembershipId, SchoolTaskId } from "../primitives/ids";
import { ArtifactRef, NonEmptyText } from "../primitives/values";
import { CalendarDate } from "../primitives/time";
import { Revision } from "../primitives/values";

export const TaskStatus = Schema.TaggedUnion({
  Open: {},
  Completed: {
    completedOn: CalendarDate,
  },
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
