import * as Schema from "effect/Schema";
import { addCalendarDays, type CalendarDate } from "../primitives/time";
import type { SchoolTask } from "./model";

export const TaskDueStatus = Schema.Literals(["Upcoming", "DueToday", "Overdue"]);
export type TaskDueStatus = typeof TaskDueStatus.Type;

export const TaskVisibilityPolicy = Schema.Struct({
  archiveCompleted: Schema.Boolean,
  archiveCancelled: Schema.Boolean,
  archiveOpenTasksAfterOverdueDays: Schema.Natural,
});
export interface TaskVisibilityPolicy extends Schema.Schema.Type<typeof TaskVisibilityPolicy> {}

export const defaultTaskVisibilityPolicy: TaskVisibilityPolicy = TaskVisibilityPolicy.make({
  archiveCompleted: true,
  archiveCancelled: true,
  archiveOpenTasksAfterOverdueDays: 7,
});

export const getTaskDueStatus = (task: SchoolTask, today: CalendarDate): TaskDueStatus =>
  task.dueDate < today ? "Overdue" : task.dueDate === today ? "DueToday" : "Upcoming";

export const isTaskArchived = (
  task: SchoolTask,
  today: CalendarDate,
  policy: TaskVisibilityPolicy = defaultTaskVisibilityPolicy,
): boolean => {
  if (task.status._tag === "Completed") return policy.archiveCompleted;
  if (task.status._tag === "Cancelled") return policy.archiveCancelled;
  return today > addCalendarDays(task.dueDate, policy.archiveOpenTasksAfterOverdueDays);
};

export const isTaskVisible = (
  task: SchoolTask,
  today: CalendarDate,
  policy: TaskVisibilityPolicy = defaultTaskVisibilityPolicy,
): boolean => !isTaskArchived(task, today, policy);
