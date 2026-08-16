import * as Schema from "effect/Schema";
import { CalendarDate } from "../foundation/calendar-date";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import type { SchoolTask } from "./school-task";

export const VisibilityPolicy = Schema.Struct({
  archiveCompleted: Schema.Boolean,
  archiveCancelled: Schema.Boolean,
  archiveOpenTasksAfterOverdueDays: Schema.Natural,
});
export interface VisibilityPolicy extends Schema.Schema.Type<typeof VisibilityPolicy> {}

export const defaultVisibilityPolicy: VisibilityPolicy = VisibilityPolicy.make({
  archiveCompleted: true,
  archiveCancelled: true,
  archiveOpenTasksAfterOverdueDays: 7,
});

export const isArchived = (
  task: SchoolTask,
  today: CalendarDate.Type,
  policy: VisibilityPolicy = defaultVisibilityPolicy,
): boolean => {
  if (task.status._tag === "Completed") return policy.archiveCompleted;
  if (task.status._tag === "Cancelled") return policy.archiveCancelled;
  const archiveAfter = CalendarDate.unsafeAddDays(
    task.dueDate,
    policy.archiveOpenTasksAfterOverdueDays,
  );
  return CalendarDate.compare(today, archiveAfter) > 0;
};

export const isVisible = (
  task: SchoolTask,
  today: CalendarDate.Type,
  policy: VisibilityPolicy = defaultVisibilityPolicy,
): boolean => !isArchived(task, today, policy);

const statusOrder = {
  Open: 0,
  Completed: 1,
  Cancelled: 2,
} as const;

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const compare = (left: SchoolTask, right: SchoolTask) =>
  statusOrder[left.status._tag] - statusOrder[right.status._tag] ||
  CalendarDate.compare(left.dueDate, right.dueDate) ||
  compareText(left.title, right.title) ||
  compareText(left.id, right.id);

export const sort = (tasks: ReadonlyArray<SchoolTask>): ReadonlyArray<SchoolTask> =>
  [...tasks].sort(compare);

export const selectForStudent = (
  tasks: ReadonlyArray<SchoolTask>,
  studentMembershipId: SchoolMembershipId,
): ReadonlyArray<SchoolTask> =>
  sort(tasks.filter((task) => task.studentMembershipId === studentMembershipId));

export const selectForCourse = (
  tasks: ReadonlyArray<SchoolTask>,
  courseOfferingId: CourseOfferingId,
): ReadonlyArray<SchoolTask> =>
  sort(tasks.filter((task) => task.courseOfferingId === courseOfferingId));

export const selectWithoutCourse = (tasks: ReadonlyArray<SchoolTask>): ReadonlyArray<SchoolTask> =>
  sort(tasks.filter((task) => task.courseOfferingId === undefined));

export const selectVisible = (
  tasks: ReadonlyArray<SchoolTask>,
  today: CalendarDate.Type,
  policy: VisibilityPolicy = defaultVisibilityPolicy,
): ReadonlyArray<SchoolTask> => sort(tasks.filter((task) => !isArchived(task, today, policy)));

export const selectArchived = (
  tasks: ReadonlyArray<SchoolTask>,
  today: CalendarDate.Type,
  policy: VisibilityPolicy = defaultVisibilityPolicy,
): ReadonlyArray<SchoolTask> => sort(tasks.filter((task) => isArchived(task, today, policy)));
