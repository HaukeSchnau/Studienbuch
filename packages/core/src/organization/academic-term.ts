import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CalendarDate } from "../foundation/calendar-date";
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
  "OverlappingAcademicTerms",
  {
    schoolId: SchoolId,
    firstTermId: AcademicTermId,
    secondTermId: AcademicTermId,
  },
) {}

export class AcademicTermUnavailable extends Schema.TaggedError<AcademicTermUnavailable>()(
  "AcademicTermUnavailable",
  {
    termId: AcademicTermId,
    reason: Schema.Literals(["Unknown", "WrongSchool", "BeforeCohortEntry"]),
  },
) {}

export const validateAcademicTerms = Effect.fn("Organization.validateAcademicTerms")(function* (
  terms: ReadonlyArray<AcademicTerm>,
) {
  const ordered = [...terms].sort((left, right) =>
    CalendarDate.compare(left.interval.start, right.interval.start),
  );
  for (const [index, first] of ordered.entries()) {
    for (const second of ordered.slice(index + 1)) {
      if (
        first.schoolId === second.schoolId &&
        CalendarDateRange.overlaps(first.interval, second.interval)
      ) {
        return yield* new OverlappingAcademicTerms({
          schoolId: first.schoolId,
          firstTermId: first.id,
          secondTermId: second.id,
        });
      }
    }
  }
  return ordered;
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
    return yield* new AcademicTermUnavailable({
      termId: targetTermId,
      reason: target === undefined ? "Unknown" : "WrongSchool",
    });
  }
  if (entryIndex < 0) {
    return yield* new AcademicTermUnavailable({ termId: cohort.entryTermId, reason: "Unknown" });
  }
  if (targetIndex < entryIndex) {
    return yield* new AcademicTermUnavailable({
      termId: targetTermId,
      reason: "BeforeCohortEntry",
    });
  }
  const progressed = Math.floor((targetIndex - entryIndex) / policy.termsPerGradeLevel);
  return GradeLevel.make(Math.min(cohort.entryGradeLevel + progressed, policy.maximumGradeLevel));
});
