import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import { AcademicTermId, CohortId, SchoolId } from "./identity";

export const GradeLevel = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })).pipe(
  Schema.brand("GradeLevel"),
);
export type GradeLevel = typeof GradeLevel.Type;

export const AcademicTerm = Schema.Struct({
  id: AcademicTermId,
  schoolId: SchoolId,
  name: NonBlankText.Schema,
  interval: CalendarDateRange.Schema,
});
export interface AcademicTerm extends Schema.Schema.Type<typeof AcademicTerm> {}

export const Cohort = Schema.Struct({
  id: CohortId,
  schoolId: SchoolId,
  name: NonBlankText.Schema,
  entryTermId: AcademicTermId,
  entryGradeLevel: GradeLevel,
});
export interface Cohort extends Schema.Schema.Type<typeof Cohort> {}

export const CohortProgressionPolicy = Schema.Struct({
  termsPerGradeLevel: Schema.Int.check(Schema.isGreaterThan(0)),
  maximumGradeLevel: GradeLevel,
});
export interface CohortProgressionPolicy extends Schema.Schema.Type<
  typeof CohortProgressionPolicy
> {}

export class OverlappingAcademicTerms extends Schema.TaggedError<OverlappingAcademicTerms>()(
  "Organization.OverlappingAcademicTerms",
  {
    schoolId: SchoolId,
    firstTermId: AcademicTermId,
    secondTermId: AcademicTermId,
  },
) {}

export class AcademicTermUnavailable extends Schema.TaggedError<AcademicTermUnavailable>()(
  "Organization.AcademicTermUnavailable",
  {
    termId: AcademicTermId,
    reason: Schema.Literals(["Unknown", "WrongSchool", "BeforeCohortEntry"]),
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

export const gradeLevelAt = Effect.fn("Organization.gradeLevelAt")(function* (
  cohort: Cohort,
  policy: CohortProgressionPolicy,
  terms: ReadonlyArray<AcademicTerm>,
  targetTermId: AcademicTermId,
) {
  const ordered = yield* validateAcademicTerms(terms);
  const schoolTerms = ordered.filter((term) => term.schoolId === cohort.schoolId);
  const entryIndex = schoolTerms.findIndex((term) => term.id === cohort.entryTermId);
  const targetIndex = schoolTerms.findIndex((term) => term.id === targetTermId);
  if (targetIndex < 0) {
    const target = ordered.find((term) => term.id === targetTermId);
    return yield* AcademicTermUnavailable.make({
      termId: targetTermId,
      reason: target === undefined ? "Unknown" : "WrongSchool",
    });
  }
  if (entryIndex < 0) {
    return yield* AcademicTermUnavailable.make({ termId: cohort.entryTermId, reason: "Unknown" });
  }
  if (targetIndex < entryIndex) {
    return yield* AcademicTermUnavailable.make({
      termId: targetTermId,
      reason: "BeforeCohortEntry",
    });
  }
  const progressed = Math.floor((targetIndex - entryIndex) / policy.termsPerGradeLevel);
  return GradeLevel.make(Math.min(cohort.entryGradeLevel + progressed, policy.maximumGradeLevel));
});
