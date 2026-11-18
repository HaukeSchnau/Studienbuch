/**
 * Stand: how fresh the school's imported data is. One row in the School space under the school's
 * id, which only the import writes. A run that publishes nothing leaves it as it was, so it ages on
 * every device when the import stops.
 */
import { Sync } from "@stu/sync";
import { CivilTime } from "../civil-time/CivilTime.ts";

export * as ImportStatus from "./ImportStatus.ts";

export const Row = Sync.table("ImportStatus", {
  class: "readable",
  fields: {
    /** When the last published snapshot was read. */
    observedAt: CivilTime.Instant,
    /** The last day of the unbroken run of covered days from the run's today. */
    coveredUntil: CivilTime.PlainDate,
  },
});

export type Row = Sync.Row<typeof Row>;
