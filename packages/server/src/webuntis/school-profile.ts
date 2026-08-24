import { Organization } from "@stu/core";

export interface WebUntisSchoolIdentity {
  readonly externalId: string;
  readonly loginName: string;
  readonly name: string;
}

export type WebUntisClassResolution =
  | {
      readonly _tag: "ClassGroup";
      readonly classGroupId: Organization.ClassGroupId;
      readonly gradeLevel: Organization.GradeLevel;
      readonly cohortEntryAcademicYearStart: number;
      readonly cohort: Organization.Cohort | undefined;
    }
  | {
      readonly _tag: "Cohort";
      readonly gradeLevel: Organization.GradeLevel;
      readonly cohortEntryAcademicYearStart: number;
      readonly cohort: Organization.Cohort | undefined;
    }
  | { readonly _tag: "Collection"; readonly reason: string };

/** School conventions that WebUntis itself does not describe. */
export interface WebUntisSchoolProfile {
  readonly schoolId: Organization.SchoolId;
  readonly matches: (school: WebUntisSchoolIdentity) => boolean;
  readonly resolveClass: (input: {
    readonly academicYearStart: number;
    readonly shortName: string;
  }) => WebUntisClassResolution;
  readonly entityId: (kind: string, externalId: string) => string;
}

const igsLilienthalCohortEntries = [
  [2012, "Heinrich"],
  [2013, "Paula"],
  [2014, "Otto"],
  [2015, "Clara"],
  [2016, "Hans"],
  [2017, "Lisel"],
  [2018, "Udo"],
  [2019, "Hermine"],
  [2020, "Bernhard"],
  [2021, "Frieda"],
  [2022, "Richard"],
  [2023, "Emmy"],
] as const;
const igsLilienthalCohortNames = new Map<number, (typeof igsLilienthalCohortEntries)[number][1]>(
  igsLilienthalCohortEntries,
);

const igsLilienthalSchoolId = Organization.SchoolId.make("igs-lilienthal");

const igsLilienthalCohort = (entryAcademicYearStart: number) => {
  const name = igsLilienthalCohortNames.get(entryAcademicYearStart);
  return name === undefined
    ? undefined
    : Organization.Cohort.make({
        id: Organization.CohortId.make(`igs-lilienthal/cohort/${entryAcademicYearStart}`),
        schoolId: igsLilienthalSchoolId,
        name,
        entryAcademicYearStart,
        entryGradeLevel: Organization.GradeLevel.make(5),
      });
};

const igsLilienthalClass = /^(?<grade>\d{1,2})\.(?<subdivision>\d+)$/;

export const igsLilienthalProfile: WebUntisSchoolProfile = {
  schoolId: igsLilienthalSchoolId,
  matches: (school) => school.loginName === "igs-lilienthal",
  resolveClass: ({ academicYearStart, shortName }) => {
    const groups = igsLilienthalClass.exec(shortName)?.groups;
    const grade = Number(groups?.grade);
    const subdivision = groups?.subdivision;
    if (groups !== undefined && grade >= 5 && grade <= 11 && subdivision !== undefined) {
      const cohortEntry = academicYearStart - (grade - 5);
      return {
        _tag: "ClassGroup",
        classGroupId: Organization.ClassGroupId.make(
          `igs-lilienthal/class/${cohortEntry}/${subdivision}`,
        ),
        gradeLevel: Organization.GradeLevel.make(grade),
        cohortEntryAcademicYearStart: cohortEntry,
        cohort: igsLilienthalCohort(cohortEntry),
      };
    }

    if (shortName === "12" || shortName === "13") {
      const grade = Number(shortName);
      return {
        _tag: "Cohort",
        gradeLevel: Organization.GradeLevel.make(grade),
        cohortEntryAcademicYearStart: academicYearStart - (grade - 5),
        cohort: igsLilienthalCohort(academicYearStart - (grade - 5)),
      };
    }

    return {
      _tag: "Collection",
      reason: `IGS timetable collection ${JSON.stringify(shortName)}`,
    };
  },
  entityId: (kind, externalId) => `igs-lilienthal/${kind}/${externalId}`,
};

const profiles: ReadonlyArray<WebUntisSchoolProfile> = [igsLilienthalProfile];

export const findSchoolProfile = (school: WebUntisSchoolIdentity) =>
  profiles.find((profile) => profile.matches(school));
