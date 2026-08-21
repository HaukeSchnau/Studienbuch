import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getCourseTasks } from "~/compat/mobile-v0";
import {
  addTaskAtom,
  addTaskAttachmentAtom,
  deleteTaskAtom,
  tasksAtom,
  toggleTaskDoneAtom,
  type AddTaskAttachmentInput,
  type AddTaskInput,
} from "./task-atoms";

export function useTasks() {
  const tasks = useAtomValue(tasksAtom);
  const writeAddTask = useAtomSet(addTaskAtom);
  const writeAddTaskAttachment = useAtomSet(addTaskAttachmentAtom);
  const writeToggleTaskDone = useAtomSet(toggleTaskDoneAtom);
  const writeDeleteTask = useAtomSet(deleteTaskAtom);

  const getTask = useCallback(
    (taskId: string) => tasks.find((task) => task.id === taskId),
    [tasks],
  );
  const getTasksForCourse = useCallback(
    (courseId?: string) => getCourseTasks(tasks, courseId),
    [tasks],
  );
  const addTask = useCallback((input: AddTaskInput) => writeAddTask(input), [writeAddTask]);
  const addTaskAttachment = useCallback(
    (taskId: string, attachment: AddTaskAttachmentInput["attachment"]) =>
      writeAddTaskAttachment({ taskId, attachment }),
    [writeAddTaskAttachment],
  );
  const toggleTaskDone = useCallback(
    (taskId: string) => writeToggleTaskDone(taskId),
    [writeToggleTaskDone],
  );
  const deleteTask = useCallback((taskId: string) => writeDeleteTask(taskId), [writeDeleteTask]);

  return {
    tasks,
    getTask,
    getCourseTasks: getTasksForCourse,
    addTask,
    addTaskAttachment,
    toggleTaskDone,
    deleteTask,
  };
}
