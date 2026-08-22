import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import { AcademicTermId, AcademicYearId, SchoolId } from "./identity";

export const AcademicTerm = Schema.Struct({
  id: AcademicTermId,
  schoolId: SchoolId,
  academicYearId: AcademicYearId,
  name: NonBlankText,
  interval: CalendarDateRange.Schema,
});
export interface AcademicTerm extends Schema.Schema.Type<typeof AcademicTerm> {}

export class OverlappingAcademicTerms extends Schema.TaggedError<OverlappingAcademicTerms>()(
  "Organization.OverlappingAcademicTerms",
  {
    schoolId: SchoolId,
    firstTermId: AcademicTermId,
    secondTermId: AcademicTermId,
  },
) {}

/**
 * The first pair of same-school terms whose intervals overlap, in start-date order.
 *
 * Both the `AcademicCalendar` schema and `validateAcademicTerms` need this rule; sharing the scan
 * is what stops them disagreeing about which term sequences are valid.
 */
export const firstTermOverlap = (
  terms: ReadonlyArray<AcademicTerm>,
):
  | { readonly index: number; readonly term: AcademicTerm; readonly otherId: AcademicTermId }
  | undefined => {
  const ordered = [...terms].sort((left, right) =>
    PlainDate.compare(left.interval.start, right.interval.start),
  );
  for (const [index, first] of ordered.entries()) {
    for (const second of ordered.slice(index + 1)) {
      if (
        first.schoolId === second.schoolId &&
        CalendarDateRange.overlaps(first.interval, second.interval)
      ) {
        return { index, term: first, otherId: second.id };
      }
    }
  }
  return undefined;
};

export const orderTermsByStart = (
  terms: ReadonlyArray<AcademicTerm>,
): ReadonlyArray<AcademicTerm> =>
  [...terms].sort((left, right) => PlainDate.compare(left.interval.start, right.interval.start));

export const validateAcademicTerms = Effect.fn("Organization.validateAcademicTerms")(function* (
  terms: ReadonlyArray<AcademicTerm>,
) {
  const overlap = firstTermOverlap(terms);
  if (overlap !== undefined) {
    return yield* OverlappingAcademicTerms.make({
      schoolId: overlap.term.schoolId,
      firstTermId: overlap.term.id,
      secondTermId: overlap.otherId,
    });
  }
  return orderTermsByStart(terms);
});
