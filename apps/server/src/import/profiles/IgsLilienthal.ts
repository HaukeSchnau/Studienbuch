/** IGS Lilienthal, the first school: its upper school is grades 11 to 13. */
import { School } from "@stu/core";
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
};
