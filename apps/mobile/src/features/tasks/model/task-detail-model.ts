import { differenceInCalendarDays, format } from "date-fns";
import { de } from "date-fns/locale/de";

import type { Task } from "~/compat/mobile-v0";
import { colors } from "~/ui/colors";

export interface TaskDetailModel {
  dueLabel: string;
  dueTone: "neutral" | "warning" | "danger" | "success";
  statusLabel: string;
  statusTone: "open" | "done";
}

const shortDate = (date: Date) => format(date, "dd.MM.", { locale: de });

export const getTaskDetailModel = (task: Task, now = new Date()): TaskDetailModel => {
  const dayDifference = differenceInCalendarDays(task.dueDate, now);

  if (task.done) {
    return {
      dueLabel:
        dayDifference === 0 ? `Heute erledigt` : `Erledigt, fällig ${shortDate(task.dueDate)}`,
      dueTone: "success",
      statusLabel: "Erledigt",
      statusTone: "done",
    };
  }

  if (dayDifference < 0) {
    return {
      dueLabel:
        dayDifference === -1
          ? "Seit gestern fällig"
          : `Seit ${Math.abs(dayDifference)} Tagen fällig`,
      dueTone: "danger",
      statusLabel: "Offen",
      statusTone: "open",
    };
  }

  if (dayDifference === 0) {
    return {
      dueLabel: "Heute fällig",
      dueTone: "warning",
      statusLabel: "Offen",
      statusTone: "open",
    };
  }

  if (dayDifference === 1) {
    return {
      dueLabel: `Morgen, ${shortDate(task.dueDate)}`,
      dueTone: "neutral",
      statusLabel: "Offen",
      statusTone: "open",
    };
  }

  return {
    dueLabel: format(task.dueDate, "EEEE, dd.MM.", { locale: de }),
    dueTone: "neutral",
    statusLabel: "Offen",
    statusTone: "open",
  };
};

export const taskToneColor = {
  danger: colors.danger.DEFAULT,
  neutral: colors.accent.sec,
  success: colors.primary.text,
  warning: colors.alert.DEFAULT,
} as const;
