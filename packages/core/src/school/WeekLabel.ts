/** The label a school gives a week, such as "A" in a school that alternates A and B weeks. */
import { Sync } from "@stu/sync";
import * as Schema from "effect/Schema";

export * as WeekLabel from "./WeekLabel.ts";

/** In the School space, under the week's ISO 8601 id such as `2026-W47` (`CivilTime.isoWeek`). */
export const Row = Sync.table("WeekLabel", {
  class: "readable",
  fields: {
    label: Schema.String,
  },
});

export type Row = Sync.Row<typeof Row>;
