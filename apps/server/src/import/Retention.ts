/**
 * How long a past lesson stays published (D113). A longer history of substitutions is a list of
 * teacher absences, which under the NPersVG needs the staff council's consent. The publish applies
 * the rule, and so does the daily sweep, which runs whatever the import does.
 */
import { CivilTime, type Lesson } from "@stu/core";
import type { Tx } from "@stu/sync";

export * as Retention from "./Retention.ts";

/** Days a lesson stays published after its day, with the change it carries. */
export const keptDays = 28;

/** The oldest day whose lessons stay on `today`, the school's date. */
export const oldestKept = (today: CivilTime.PlainDate) => CivilTime.addDays(today, -keptDays);

/** Whether a lesson's day is more than `keptDays` before `today`. */
export const expired = (today: CivilTime.PlainDate) => {
  const oldest = oldestKept(today);

  return ({ row }: Tx.Entry<Lesson.Row>) => CivilTime.order(row.date, oldest) < 0;
};
