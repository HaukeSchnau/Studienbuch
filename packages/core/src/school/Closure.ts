/** Ferien, Feiertag: dates without school, such as the autumn holidays or a public holiday. */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";

export * as Closure from "./Closure.ts";

export const Id = Ids.Id.pipe(Schema.brand("ClosureId"));

export type Id = typeof Id.Type;

/** In the School space. */
export const Row = Sync.table("Closure", {
  class: "readable",
  fields: {
    /** Such as "Herbstferien". */
    name: Schema.String,
    /**
     * Its dates as ranges in order, which neither overlap nor touch. Usually one; a closure that
     * was shortened after it began keeps its past dates as a range of their own.
     */
    dates: Schema.Array(CivilTime.DateRange),
  },
});

export type Row = Sync.Row<typeof Row>;
