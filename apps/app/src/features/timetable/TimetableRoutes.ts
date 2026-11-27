// Where the timetable's screens live, so every link to one names it the same.

export * as TimetableRoutes from "./TimetableRoutes.ts";

/** The lesson sheet, over the Übersicht or Meine Woche, whichever tab opens it. */
export const lesson = (id: string) => `/stunden/${id}` as const;
