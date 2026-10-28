/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: a section divider */
// ----- Helpers -----

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: a marker without an issue */
// TODO: handle the empty week
export const week = 7;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: a PR number */
// Fixed in #1234 because the week started on Sunday.
export const firstDay = 1;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: commented-out code */
// const lastDay = 5;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: repeats the name below */
// The lesson count.
export const lessonCount = 8;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: a JSDoc type */
/** @param {number} day the day of the week */
export const dayName = (day: number) => `Tag ${day}`;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: five lines of background */
// The timetable once came from a spreadsheet that the school exported every Friday.
// Teachers then copied it into the old app by hand, which took most of an afternoon.
// The importer replaced that, and it reads the same columns the spreadsheet had.
// It keeps their order, because the school's other tools still expect it.
// Nobody has asked to change it since.
export const columns = ["day", "period", "course"];

// A marker that links its issue stays: TODO https://git.schnau.dev/schnau/studienbuch/issues/1
export const periods = 10;

/**
 * A usage example doesn't count toward the limit.
 *
 * ```ts
 * const name = dayName(1);
 * const next = dayName(2);
 * const last = dayName(5);
 * ```
 */
export const example = dayName;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: a directive doesn't excuse long prose */
// The debugger stays while the timetable importer is new, because the school sends a new export
// format every term and the importer still guesses at some of its columns.
// Teachers report the misread columns by mail, and someone has to look at the raw rows.
// Pausing here shows them before the projection runs.
// The pause costs nothing in production, where nobody attaches a debugger.
// oxlint-disable-next-line eslint/no-debugger -- see above
debugger;

/* oxlint-disable-next-line studienbuch/no-low-value-comments -- fixture: an unclosed fence hides nothing */
/**
 * Formats a day.
 * ```ts
 * dayName(1);
 * dayName(2);
 * dayName(3);
 */
export const unclosed = dayName;
