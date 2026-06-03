import type { Task } from "./model";

export const getCourseTasks = (tasks: Task[], courseId?: string) =>
  [...tasks]
    .filter((task) => (courseId ? task.courseId === courseId : true))
    .sort((a, b) => {
      if (a.done !== b.done) {
        return Number(a.done) - Number(b.done);
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
