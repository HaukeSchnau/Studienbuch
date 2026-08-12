import type { Task } from "@stu/core";

export interface TaskOverviewModel {
  tasks: Task[];
  columns: Task[][];
  crossAxisCount: number;
  sectionHeight: number;
}

export const getTaskOverviewModel = (tasks: Task[]): TaskOverviewModel => {
  const crossAxisCount = tasks.length < 4 ? 1 : 2;
  const columns = Array.from({ length: Math.ceil(tasks.length / crossAxisCount) }, (_, index) =>
    tasks.slice(index * crossAxisCount, (index + 1) * crossAxisCount),
  );

  return {
    tasks,
    columns,
    crossAxisCount,
    sectionHeight: 225 * crossAxisCount,
  };
};
