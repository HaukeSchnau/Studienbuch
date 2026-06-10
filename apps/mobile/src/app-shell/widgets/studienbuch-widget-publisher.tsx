import type { Task } from "@stu/core";
import { useEffect } from "react";
import { useCourses, useTasks } from "~/data/hooks";
import {
  publishDefaultStudienbuchWidgetSnapshot,
  publishStudienbuchWidgetSnapshot,
  type StudienbuchWidgetSnapshot,
} from "~/platform/widgets/studienbuch-widget";

const dueDateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  weekday: "short",
});

export function StudienbuchWidgetPublisher() {
  const { tasks } = useTasks();
  const { getCourse } = useCourses();

  useEffect(() => {
    const openTasks = tasks.filter((task) => !task.done);
    const nextTask = getNextOpenTask(openTasks);
    const course = nextTask ? getCourse(nextTask.courseId) : undefined;

    const snapshot: StudienbuchWidgetSnapshot = {
      openTaskCount: openTasks.length,
      nextTaskTitle: nextTask?.title ?? "Alles erledigt",
      nextTaskContext: nextTask
        ? `${course?.name ?? "Kurs"} · ${dueDateFormatter.format(nextTask.dueDate)}`
        : "Keine offenen Aufgaben",
      statusLine:
        openTasks.length === 0
          ? "Du bist auf dem aktuellen Stand."
          : `${openTasks.length} offene ${openTasks.length === 1 ? "Aufgabe" : "Aufgaben"}`,
    };

    publishStudienbuchWidgetSnapshot(snapshot);
  }, [getCourse, tasks]);

  return null;
}

export function StudienbuchDefaultWidgetPublisher() {
  useEffect(() => {
    publishDefaultStudienbuchWidgetSnapshot();
  }, []);

  return null;
}

function getNextOpenTask(tasks: Task[]) {
  let nextTask: Task | undefined;

  for (const task of tasks) {
    if (!nextTask || task.dueDate.getTime() < nextTask.dueDate.getTime()) {
      nextTask = task;
    }
  }

  return nextTask;
}
