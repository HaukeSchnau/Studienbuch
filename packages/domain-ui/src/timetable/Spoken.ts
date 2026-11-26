/**
 * What a screen reader says for a lesson, where a row or a cell shows struck names and notes. It
 * imports no domain code, so the landing page's phones load none.
 */
import type { AgendaItem } from "./AgendaItem.ts";

export * as Spoken from "./Spoken.ts";

/** The pill on a lesson with homework due, which a screen reader says as it reads. */
export const homeworkOpen = "Hausaufgabe offen";

/** "Voss statt Brandt", as a screen reader says what a struck name shows. */
export const named = (each: AgendaItem.Named): string =>
  each.was === undefined ? each.now : `${each.now || "niemand"} statt ${each.was}`;

/** "Mathematik, 09:50 bis 11:20, Vertretung, Voss statt Brandt, A101, Hausaufgabe offen" */
export const lesson = (item: AgendaItem.Lesson): string =>
  [
    item.subject,
    item.time.replace("–", " bis "),
    ...(item.off === undefined ? [] : [item.off]),
    ...(item.note === undefined ? [] : [item.note]),
    ...[item.teacher, item.room].flatMap((each) => (each === undefined ? [] : [named(each)])),
    ...(item.homework === true ? [homeworkOpen] : []),
    ...(item.phase === "past" ? ["vorbei"] : []),
    ...(item.remaining === undefined ? [] : [item.remaining]),
  ].join(", ");
