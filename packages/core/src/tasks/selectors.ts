import type { CourseOfferingId, SchoolMembershipId } from "../primitives/ids";
import type { CalendarDate } from "../primitives/time";
import type { SchoolTask } from "./model";
import { defaultTaskVisibilityPolicy, isTaskArchived, type TaskVisibilityPolicy } from "./policies";

const statusOrder = {
  Open: 0,
  Completed: 1,
  Cancelled: 2,
} as const;

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const compareTasks = (left: SchoolTask, right: SchoolTask) =>
  statusOrder[left.status._tag] - statusOrder[right.status._tag] ||
  compareText(left.dueDate, right.dueDate) ||
  compareText(left.title, right.title) ||
  compareText(left.id, right.id);

export const sortTasks = (tasks: ReadonlyArray<SchoolTask>): ReadonlyArray<SchoolTask> =>
  [...tasks].sort(compareTasks);

export const selectTasksForStudent = (
  tasks: ReadonlyArray<SchoolTask>,
  studentMembershipId: SchoolMembershipId,
): ReadonlyArray<SchoolTask> =>
  sortTasks(tasks.filter((task) => task.studentMembershipId === studentMembershipId));

export const selectTasksForCourse = (
  tasks: ReadonlyArray<SchoolTask>,
  courseOfferingId: CourseOfferingId,
): ReadonlyArray<SchoolTask> =>
  sortTasks(tasks.filter((task) => task.courseOfferingId === courseOfferingId));

export const selectTasksWithoutCourse = (
  tasks: ReadonlyArray<SchoolTask>,
): ReadonlyArray<SchoolTask> =>
  sortTasks(tasks.filter((task) => task.courseOfferingId === undefined));

export const selectVisibleTasks = (
  tasks: ReadonlyArray<SchoolTask>,
  today: CalendarDate,
  policy: TaskVisibilityPolicy = defaultTaskVisibilityPolicy,
): ReadonlyArray<SchoolTask> =>
  sortTasks(tasks.filter((task) => !isTaskArchived(task, today, policy)));

export const selectArchivedTasks = (
  tasks: ReadonlyArray<SchoolTask>,
  today: CalendarDate,
  policy: TaskVisibilityPolicy = defaultTaskVisibilityPolicy,
): ReadonlyArray<SchoolTask> =>
  sortTasks(tasks.filter((task) => isTaskArchived(task, today, policy)));
