import type { Task } from "./model";

const archivalWindowMs = 7 * 24 * 60 * 60 * 1000;

export const isTaskArchived = (task: Task, now = new Date()) =>
  task.done || task.dueDate.getTime() + archivalWindowMs < now.getTime();
