/**
 * What the import knows about one school beyond what WebUntis says (m2-import-path.md, section 6):
 * how its classes are named, which grade levels enter Studienbuch, and the phrases its substitution
 * texts use. A school's profile is a module of its own, such as `IgsLilienthal.ts`.
 */
import type { School } from "@stu/core";
import type * as Cron from "effect/Cron";
import * as Data from "effect/Data";
import * as Option from "effect/Option";

export * as SchoolProfile from "./SchoolProfile.ts";

/** What a WebUntis class resource stands for at the school. */
export type Classification = Data.TaggedEnum<{
  /** A class such as `11.2` that its students keep all year: a `SchoolClass` row. */
  Lasting: { readonly gradeLevel: School.GradeLevel };
  /** A whole grade level, such as `12` where the upper school has no classes. */
  CohortWide: { readonly gradeLevel: School.GradeLevel };
  /** A resource that gathers classes, such as `8`, or isn't a class. The import never reads it. */
  Collection: {};
}>;

export const Classification = Data.taggedEnum<Classification>();

export interface SchoolProfile {
  readonly id: School.Id;
  readonly school: School.Row;
  /** The grade levels whose courses, classes and lessons enter the School space. */
  readonly gradeLevels: ReadonlyArray<School.GradeLevel>;
  /** By the class's WebUntis short name. */
  readonly classify: (name: string) => Classification;
  /**
   * The substitution texts a lesson may show. Any other text stays out of rows, because a Course
   * space's readers chose the course themselves and free text can name a student.
   */
  readonly stockPhrases: ReadonlyArray<string>;
  /**
   * Whether a run writes the school's rows. Without it a run reads, stores and imports, and keeps
   * its checkpoint, so the first publish starts from ids and removals that have held for weeks.
   */
  readonly publish: boolean;
  readonly thresholds: Thresholds;
}

/**
 * The bar each measure of the nightly self-check has to clear before students see the import
 * (m2-import-path.md, section 7, and go 2). Nothing gates on it yet.
 */
export interface Thresholds {
  /** Student-weeks exactly right, of those scored: a share from 0 to 1. */
  readonly studentWeeks: number;
  /** Students' entries their Kurswahl's lessons cover. */
  readonly recall: number;
  /** Lessons of a student's Kurswahl that cover one of their entries. */
  readonly precision: number;
  /** Kurswahlen that give their students exactly their entries of the weeks they were taken from. */
  readonly kurswahl: number;
  /** Real courses split over several of ours, at most. */
  readonly split: number;
  /** Courses of ours that join several real ones, at most. */
  readonly merged: number;
  /** Courses with lessons no student chose, at most. */
  readonly ghostCourses: number;
}

/** One kind of a school's import runs. */
export interface Run {
  /** When it starts, in the school's time zone. */
  readonly cron: Cron.Cron;
  /** The nightly run, which alone creates courses and offerings. */
  readonly nightly: boolean;
  /** The most requests it may send, logins and retries included, reserved before the first. */
  readonly maximum: number;
}

/** When a school's import runs: through the day, and once a night. */
export interface Schedule {
  readonly daytime: Run;
  readonly nightly: Run;
}

/** The grade level of a class whose lessons the import reads, if it reads them. */
export const gradeLevelRead = (
  profile: SchoolProfile,
  classification: Classification,
): Option.Option<School.GradeLevel> =>
  classification._tag !== "Collection" && profile.gradeLevels.includes(classification.gradeLevel)
    ? Option.some(classification.gradeLevel)
    : Option.none();

/**
 * Whether the nightly run reads this student's own timetable: one of their classes is of a grade
 * level whose lessons the import reads.
 */
export const readsStudent = (
  profile: SchoolProfile,
  student: { readonly classes: ReadonlyArray<{ readonly class: { readonly shortName: string } }> },
) =>
  student.classes.some(({ class: each }) =>
    Option.isSome(gradeLevelRead(profile, profile.classify(each.shortName))),
  );

// Compatibility forms such as full-width letters and composed umlauts compare as their plain forms.
const comparable = (text: string) =>
  text.normalize("NFKC").trim().replaceAll(/\s+/gu, " ").toLocaleLowerCase("de");

/**
 * The stock phrase `text` is, in the profile's own spelling, so the row holds our constant and
 * never the text WebUntis sent.
 */
export const stockPhrase = (profile: SchoolProfile, text: string): Option.Option<string> =>
  Option.fromUndefinedOr(
    profile.stockPhrases.find((phrase) => comparable(phrase) === comparable(text)),
  );
