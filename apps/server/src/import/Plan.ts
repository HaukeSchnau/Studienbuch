/**
 * Which views a run reads (m2-import-path.md, section 1). The run's reader and the import ask the
 * same question here, so an import over a run's snapshot never asks for a view the run didn't read.
 */
import { CivilTime, type School, type SchoolYear } from "@stu/core";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { SchoolProfile } from "./profiles/SchoolProfile.ts";
import type { SchoolImport } from "./SchoolImport.ts";

export * as Plan from "./Plan.ts";

/** Days a run reads: today and the 27 after it, at the school. */
export const windowDays = 28;

/** Today to four weeks ahead at the school, when `now` is the run's first read. */
export const window = (school: School.Row, now: DateTime.Utc): CivilTime.DateRange => {
  const today = CivilTime.dateIn(DateTime.toEpochMillis(now), school.timeZone);

  return { start: today, end: CivilTime.addDays(today, windowDays - 1) };
};

/**
 * The WebUntis ids of the classes whose views a run reads: the directory's classes of the
 * profile's grade levels, and every class the import knew this school year, so a directory that
 * drops a class can't make its lessons look gone. WebUntis gives classes new ids each year, so
 * only this year's offerings and classes name them.
 */
export const classes = (input: {
  readonly profile: SchoolProfile.SchoolProfile;
  readonly previous: SchoolImport.ImportResult;
  readonly directory: ReadonlyArray<{ readonly id: number; readonly shortName: string }>;
  readonly schoolYear: SchoolYear.Id;
}) => {
  const { profile, previous, schoolYear } = input;

  const termsOfYear = new Set(
    previous.terms.flatMap(({ id, schoolYearId }) => (schoolYearId === schoolYear ? [id] : [])),
  );

  const ofYear = new Set<string>([
    ...previous.offerings.flatMap(({ courseId, termId }) =>
      termsOfYear.has(termId) ? [courseId] : [],
    ),
    ...previous.classes.flatMap(({ id, schoolYearId }) =>
      schoolYearId === schoolYear ? [id] : [],
    ),
  ]);

  const known = previous.links.flatMap((link) =>
    ofYear.has(link.id)
      ? link.refs.flatMap((ref) =>
          ref._tag === "Resource" && ref.type === "CLASS" ? [ref.id] : [],
        )
      : [],
  );

  const listed = input.directory.flatMap(({ id, shortName }) =>
    Option.isSome(SchoolProfile.gradeLevelRead(profile, profile.classify(shortName))) ? [id] : [],
  );

  return Arr.dedupe([...listed, ...known]).sort((a, b) => a - b);
};

/** The WebUntis ids of the students whose own views the nightly run reads, in id order. */
export const students = (
  profile: SchoolProfile.SchoolProfile,
  directory: ReadonlyArray<
    Parameters<typeof SchoolProfile.readsStudent>[1] & {
      readonly student: { readonly id: number };
    }
  >,
) =>
  Arr.dedupe(
    directory.flatMap((each) =>
      SchoolProfile.readsStudent(profile, each) ? [each.student.id] : [],
    ),
  ).sort((a, b) => a - b);

/**
 * The WebUntis school year that holds the window's first day, its dates, and the window's last day
 * within it: a run's window ends with its school year, whose successor its own runs read.
 */
export const schoolYear = <
  Year extends { readonly dateRange: { readonly start: string; readonly end: string } },
>(
  years: ReadonlyArray<Year>,
  window: CivilTime.DateRange,
) => {
  const first = CivilTime.format(window.start);

  const year = years.find(
    ({ dateRange }) => dateRange.start.slice(0, 10) <= first && first <= dateRange.end.slice(0, 10),
  );

  return Option.map(Option.fromUndefinedOr(year), (found) => {
    const start = found.dateRange.start.slice(0, 10);
    const end = found.dateRange.end.slice(0, 10);
    const windowEnd = CivilTime.format(window.end);

    return { year: found, start, end, last: windowEnd <= end ? windowEnd : end };
  });
};
