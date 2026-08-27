import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getCourseTasks as selectCourseTasks } from "~/compat/mobile-v0";
import {
  addTaskAtom,
  addTaskAttachmentAtom,
  deleteTaskAtom,
  tasksAtom,
  toggleTaskDoneAtom,
  type AddTaskAttachmentInput,
} from "./task-atoms";

export function useTasks() {
  const tasks = useAtomValue(tasksAtom);
  const addTask = useAtomSet(addTaskAtom);
  const writeAddTaskAttachment = useAtomSet(addTaskAttachmentAtom);
  const toggleTaskDone = useAtomSet(toggleTaskDoneAtom);
  const deleteTask = useAtomSet(deleteTaskAtom);

  const getTask = useCallback(
    (taskId: string) => tasks.find((task) => task.id === taskId),
    [tasks],
  );
  const getCourseTasks = useCallback(
    (courseId?: string) => selectCourseTasks(tasks, courseId),
    [tasks],
  );
  const addTaskAttachment = useCallback(
    (taskId: string, attachment: AddTaskAttachmentInput["attachment"]) =>
      writeAddTaskAttachment({ taskId, attachment }),
    [writeAddTaskAttachment],
  );
  return {
    tasks,
    getTask,
    getCourseTasks,
    addTask,
    addTaskAttachment,
    toggleTaskDone,
    deleteTask,
  };
}
