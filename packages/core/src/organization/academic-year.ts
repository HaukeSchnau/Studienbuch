import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import { AcademicYearId, CohortId, SchoolId } from "./identity";

export const AcademicYear = Schema.Struct({
  id: AcademicYearId,
  schoolId: SchoolId,
  name: NonBlankText,
  interval: CalendarDateRange.Schema,
});
export interface AcademicYear extends Schema.Schema.Type<typeof AcademicYear> {}

export const GradeLevel = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })).pipe(
  Schema.brand("GradeLevel"),
);
export type GradeLevel = typeof GradeLevel.Type;

export const Cohort = Schema.Struct({
  id: CohortId,
  schoolId: SchoolId,
  name: NonBlankText,
  /** Calendar year in which the cohort's first academic year began. */
  entryAcademicYearStart: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 9999 })),
  entryGradeLevel: GradeLevel,
});
export interface Cohort extends Schema.Schema.Type<typeof Cohort> {}

export const CohortProgressionPolicy = Schema.Struct({
  maximumGradeLevel: GradeLevel,
});
export interface CohortProgressionPolicy extends Schema.Schema.Type<
  typeof CohortProgressionPolicy
> {}

export class OverlappingAcademicYears extends Schema.TaggedError<OverlappingAcademicYears>()(
  "Organization.OverlappingAcademicYears",
  {
    schoolId: SchoolId,
    firstAcademicYearId: AcademicYearId,
    secondAcademicYearId: AcademicYearId,
  },
) {}

export class AcademicYearUnavailable extends Schema.TaggedError<AcademicYearUnavailable>()(
  "Organization.AcademicYearUnavailable",
  {
    academicYearId: AcademicYearId,
    reason: Schema.Literals(["Unknown", "WrongSchool", "BeforeCohortEntry"]),
  },
) {}

export const firstAcademicYearOverlap = (
  academicYears: ReadonlyArray<AcademicYear>,
):
  | {
      readonly index: number;
      readonly academicYear: AcademicYear;
      readonly otherId: AcademicYearId;
    }
  | undefined => {
  const ordered = [...academicYears].sort((left, right) =>
    PlainDate.compare(left.interval.start, right.interval.start),
  );
  for (const [index, first] of ordered.entries()) {
    for (const second of ordered.slice(index + 1)) {
      if (
        first.schoolId === second.schoolId &&
        CalendarDateRange.overlaps(first.interval, second.interval)
      ) {
        return { index, academicYear: first, otherId: second.id };
      }
    }
  }
  return undefined;
};

export const orderAcademicYearsByStart = (
  academicYears: ReadonlyArray<AcademicYear>,
): ReadonlyArray<AcademicYear> =>
  [...academicYears].sort((left, right) =>
    PlainDate.compare(left.interval.start, right.interval.start),
  );

export const validateAcademicYears = Effect.fn("Organization.validateAcademicYears")(function* (
  academicYears: ReadonlyArray<AcademicYear>,
) {
  const overlap = firstAcademicYearOverlap(academicYears);
  if (overlap !== undefined) {
    return yield* OverlappingAcademicYears.make({
      schoolId: overlap.academicYear.schoolId,
      firstAcademicYearId: overlap.academicYear.id,
      secondAcademicYearId: overlap.otherId,
    });
  }
  return orderAcademicYearsByStart(academicYears);
});

/** Calculates progression from explicit academic years without consulting the ambient date. */
export const gradeLevelAt = Effect.fn("Organization.gradeLevelAt")(function* (
  cohort: Cohort,
  policy: CohortProgressionPolicy,
  academicYears: ReadonlyArray<AcademicYear>,
  targetAcademicYearId: AcademicYearId,
) {
  const ordered = yield* validateAcademicYears(academicYears);
  const schoolYears = ordered.filter((academicYear) => academicYear.schoolId === cohort.schoolId);
  const targetIndex = schoolYears.findIndex(
    (academicYear) => academicYear.id === targetAcademicYearId,
  );
  if (targetIndex < 0) {
    const target = ordered.find((academicYear) => academicYear.id === targetAcademicYearId);
    return yield* AcademicYearUnavailable.make({
      academicYearId: targetAcademicYearId,
      reason: target === undefined ? "Unknown" : "WrongSchool",
    });
  }
  const target = schoolYears[targetIndex];
  if (target === undefined) {
    return yield* AcademicYearUnavailable.make({
      academicYearId: targetAcademicYearId,
      reason: "Unknown",
    });
  }
  const yearsSinceEntry = target.interval.start.year - cohort.entryAcademicYearStart;
  if (yearsSinceEntry < 0) {
    return yield* AcademicYearUnavailable.make({
      academicYearId: targetAcademicYearId,
      reason: "BeforeCohortEntry",
    });
  }
  return GradeLevel.make(
    Math.min(cohort.entryGradeLevel + yearsSinceEntry, policy.maximumGradeLevel),
  );
});
