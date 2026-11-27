/** IGS Lilienthal, the first school: its upper school is grades 11 to 13. */
import { School } from "@stu/core";
import * as Cron from "effect/Cron";
import { SchoolProfile } from "./SchoolProfile.ts";

export * as IgsLilienthal from "./IgsLilienthal.ts";

// ASCII digits only: a name in another script is no class of ours.
const lasting = /^(?<grade>[0-9]{1,2})\.[0-9]{1,2}$/u;
const wholeGrade = /^(?<grade>[0-9]{1,2})$/u;

/** Grades whose courses span the whole grade, because the upper school has no classes there. */
const cohortWide: ReadonlySet<number> = new Set([12, 13]);

const isGradeLevel = (grade: number): grade is School.GradeLevel => grade >= 1 && grade <= 13;

/**
 * `11.2` is a lasting class of grade 11, `12` the whole of grade 12, and `8` gathers grade 8's
 * classes. Grades 12 and 13 never get a class, even one named `12.1`: a class there would make
 * `enrollment.set` ask their students for one and refuse the choices they kept.
 */
export const classify = (name: string): SchoolProfile.Classification => {
  const ofClass = Number(lasting.exec(name)?.groups?.grade);
  const ofGrade = Number(wholeGrade.exec(name)?.groups?.grade);
  const grade = isGradeLevel(ofClass) ? ofClass : ofGrade;

  if (isGradeLevel(grade) && cohortWide.has(grade)) {
    return SchoolProfile.Classification.CohortWide({ gradeLevel: grade });
  }

  return isGradeLevel(ofClass)
    ? SchoolProfile.Classification.Lasting({ gradeLevel: ofClass })
    : SchoolProfile.Classification.Collection();
};

export const profile: SchoolProfile.SchoolProfile = {
  id: School.Id.make("igs-lilienthal"),
  school: { name: "IGS Lilienthal", timeZone: School.defaultTimeZone },
  gradeLevels: [11, 12, 13],
  classify,
  stockPhrases: [
    "Entfall",
    "Ausfall",
    "Vertretung",
    "Freisetzung",
    "Betreuung",
    "EVA",
    "Aufgaben",
    "Raumänderung",
    "Raumwechsel",
    "verlegt",
    "Verlegung",
    "Klausur",
    "Lernkontrolle",
    "Aufsicht",
    "Exkursion",
  ],
  // Go 2 (m2-import-path.md, "What needs Hauke") turns it on, in a reviewed pull request.
  publish: false,
  // What a student needs before seeing the import: about one wrong lesson in two weeks of 30, no
  // course that shows them another group's lessons, and a Kurswahl that just works for nine in
  // ten. Go 2 approves or changes them.
  thresholds: {
    studentWeeks: 0.9,
    recall: 0.98,
    precision: 0.98,
    kurswahl: 0.9,
    split: 0,
    merged: 0,
    ghostCourses: 0,
  },
};

/**
 * Every ten minutes from 06:00 to 21:50, and nightly at 05:30. A run sends 17 of its 26 requests;
 * the nightly one adds the self-check's student directory and 181 student views, 199 of its 300.
 * 2,796 a day of the cap's 3,000, and none near midnight, where a reservation's requests stop.
 */
export const schedule: SchoolProfile.Schedule = {
  daytime: {
    cron: Cron.parseUnsafe("*/10 6-21 * * *", profile.school.timeZone),
    nightly: false,
    maximum: 26,
  },
  nightly: {
    cron: Cron.parseUnsafe("30 5 * * *", profile.school.timeZone),
    nightly: true,
    maximum: 300,
  },
};

/**
 * The weekly export of the source store into the corpus: Sunday night at 00:30, after Sunday's
 * last run and before Monday's nightly one, so no run writes the store while the export reads it.
 */
export const weeklyExport = Cron.parseUnsafe("30 0 * * 1", profile.school.timeZone);
