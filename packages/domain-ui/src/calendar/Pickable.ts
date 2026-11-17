import { CivilTime } from "@stu/core";
import * as Order from "effect/Order";

// Which days a date picker lets the student pick, and how far it pages.

export * as Pickable from "./Pickable.ts";

export interface Days {
  readonly range: CivilTime.DateRange;
  /** One day outside `range` that stays pickable, as an edited homework's own due date once past. */
  readonly kept?: CivilTime.PlainDate | undefined;
}

export const contains = ({ range, kept }: Days, day: CivilTime.PlainDate): boolean =>
  CivilTime.contains(range, day) || (kept !== undefined && CivilTime.order(kept, day) === 0);

/** The span the picker pages through: `range`, widened to reach `kept`. */
export const reach = ({ range, kept }: Days): CivilTime.DateRange =>
  kept === undefined
    ? range
    : {
        start: Order.min(CivilTime.order)(range.start, kept),
        end: Order.max(CivilTime.order)(range.end, kept),
      };
