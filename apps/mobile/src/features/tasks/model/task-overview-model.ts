import type { Task } from "@stu/core";

export interface TaskOverviewModel {
  tasks: Task[];
  crossAxisCount: number;
  sectionHeight: number;
}

export const getTaskOverviewModel = (tasks: Task[]): TaskOverviewModel => {
  const crossAxisCount = tasks.length < 4 ? 1 : 2;

  return {
    tasks,
    crossAxisCount,
    sectionHeight: 225 * crossAxisCount,
  };
};
