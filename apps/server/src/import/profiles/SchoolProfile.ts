/**
 * What the import knows about one school beyond what WebUntis says (m2-import-path.md, section 6):
 * how its classes are named, which grade levels enter Studienbuch, and the phrases its substitution
 * texts use. A school's profile is a module of its own, such as `IgsLilienthal.ts`.
 */
import type { School } from "@stu/core";
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
}

/** The grade level of a class whose lessons the import reads, if it reads them. */
export const gradeLevelRead = (
  profile: SchoolProfile,
  classification: Classification,
): Option.Option<School.GradeLevel> =>
  classification._tag !== "Collection" && profile.gradeLevels.includes(classification.gradeLevel)
    ? Option.some(classification.gradeLevel)
    : Option.none();

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
