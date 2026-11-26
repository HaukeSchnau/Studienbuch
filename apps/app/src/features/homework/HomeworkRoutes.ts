import { CivilTime } from "@stu/core";
import * as Option from "effect/Option";
import type { ImperativeRouter } from "expo-router";

// Where homework's screens live in the Übersicht's stack, so every link to one names it the same.

export * as HomeworkRoutes from "./HomeworkRoutes.ts";

export const list = "/hausaufgaben";

export const add = "/hausaufgaben/neu";

/**
 * The add sheet with the course chosen and due on `dueOn`, as "Hausaufgabe eintragen" on a lesson
 * opens it (`HomeworkInput.prefilled` reads them).
 */
export const addFor = (courseId: string, dueOn: Option.Option<CivilTime.PlainDate>) =>
  ({
    pathname: add,
    params: Option.match(dueOn, {
      onNone: () => ({ courseId }),
      onSome: (date) => ({ courseId, dueOn: CivilTime.format(date) }),
    }),
  }) as const;

export const detail = (id: string) => `/hausaufgaben/${id}` as const;

export const edit = (id: string) => `/hausaufgaben/${id}/bearbeiten` as const;

/**
 * Back to the screen before, or to `fallback` when the page was opened by its address and nothing
 * lies behind it in the stack, as on the web after a reload.
 */
export const back = (router: ImperativeRouter, fallback: typeof list | "/") => {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
};
