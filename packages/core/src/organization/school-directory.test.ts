import { assert, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import type { NonBlankText } from "../foundation/non-blank-text";
import {
  AcademicTerm,
  AcademicYear,
  Cohort,
  CohortProgressionPolicy,
  CourseChoiceGroup,
  CourseOffering,
  Enrollment,
  EnrollmentOrigin,
  GradeLevel,
  Room,
  School,
  SchoolDirectory,
  Subject,
  SubjectCatalog,
  gradeLevelAt,
  removeEnrollment,
  suggestEnrollmentContinuations,
  validateSchoolDirectory,
  validateAcademicTerms,
  validateAcademicYears,
  validateCourseChoice,
  AcademicTermId,
  AcademicYearId,
  BuildingId,
  CohortId,
  CourseChoiceGroupId,
  CourseOfferingId,
  EnrollmentId,
  SchoolId,
  SchoolMembershipId,
  RoomId,
  SubjectId,
} from "./index.ts";

const date = (value: string) => PlainDate.fromString(value, Calendar.getBasic);
const interval = (start: string, end: string) =>
  CalendarDateRange.Schema.make({ start: date(start), end: date(end) });
const schoolId = SchoolId.make("school-1");
const academicYear = (id: NonBlankText, start: string, end: string) =>
  AcademicYear.make({
    id: AcademicYearId.make(id),
    schoolId,
    name: id,
    interval: interval(start, end),
  });
const term = (
  id: NonBlankText,
  start: string,
  end: string,
  academicYearId = AcademicYearId.make("year-1"),
) =>
  AcademicTerm.make({
    id: AcademicTermId.make(id),
    schoolId,
    academicYearId,
    name: id,
    interval: interval(start, end),
  });

describe("academic years, terms, and cohort progression", () => {
  it.effect("round-trips its nested calendar-date range at the wire boundary", () =>
    Effect.gen(function* () {
      const encoded = {
        id: "term-a",
        schoolId: "school-1",
        academicYearId: "year-1",
        name: "First term",
        interval: { start: "2026-08-01", end: "2027-01-31" },
      };
      const decoded = yield* Schema.decodeEffect(AcademicTerm)(encoded);

      assert.strictEqual(PlainDate.toString(decoded.interval.start), "2026-08-01");
      assert.deepStrictEqual(yield* Schema.encodeEffect(AcademicTerm)(decoded), encoded);
    }),
  );

  it.effect("rejects overlapping school terms, including a shared boundary date", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateAcademicTerms([
          term("term-a", "2026-08-01", "2027-01-31"),
          term("term-b", "2027-01-31", "2027-07-31"),
        ]),
      );
      assert.strictEqual(error._tag, "Organization.OverlappingAcademicTerms");
      assert.strictEqual(error.firstTermId, AcademicTermId.make("term-a"));
    }),
  );

  it.effect("rejects overlapping academic years", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateAcademicYears([
          academicYear("year-a", "2026-08-01", "2027-07-31"),
          academicYear("year-b", "2027-07-31", "2028-07-31"),
        ]),
      );
      assert.strictEqual(error._tag, "Organization.OverlappingAcademicYears");
      assert.strictEqual(error.firstAcademicYearId, AcademicYearId.make("year-a"));
    }),
  );

  it.effect("progresses from an explicit entry year without consulting the current date", () =>
    Effect.gen(function* () {
      const firstYear = academicYear("y1", "2026-08-01", "2027-07-31");
      const secondYear = academicYear("y2", "2027-08-01", "2028-07-31");
      const academicYears = [firstYear, secondYear];
      const cohort = Cohort.make({
        id: CohortId.make("cohort-1"),
        schoolId,
        name: "2026 intake",
        entryAcademicYearId: firstYear.id,
        entryGradeLevel: GradeLevel.make(5),
      });
      const policy = CohortProgressionPolicy.make({
        maximumGradeLevel: GradeLevel.make(13),
      });

      assert.strictEqual(yield* gradeLevelAt(cohort, policy, academicYears, firstYear.id), 5);
      assert.strictEqual(yield* gradeLevelAt(cohort, policy, academicYears, secondYear.id), 6);
    }),
  );
});

describe("school directory", () => {
  it.effect("rejects a foreign-school course offering", () =>
    Effect.gen(function* () {
      const year = academicYear("year-1", "2026-08-01", "2027-07-31");
      const academicTerm = term("term-1", "2026-08-01", "2027-07-31", year.id);
      const subject = Subject.make({
        id: SubjectId.make("mathematics"),
        schoolId,
        name: "Mathematics",
        aliases: [],
      });
      const offering = CourseOffering.make({
        id: CourseOfferingId.make("foreign-offering"),
        schoolId: SchoolId.make("other-school"),
        termId: academicTerm.id,
        subjectId: subject.id,
        name: "Mathematics",
        classGroupIds: [],
      });
      const structure = SchoolDirectory.make({
        school: School.make({ id: schoolId, name: "School" }),
        subjectCatalog: SubjectCatalog.make({ schoolId, subjects: [subject] }),
        academicYears: [year],
        terms: [academicTerm],
        cohorts: [],
        departments: [],
        buildings: [],
        rooms: [],
        classGroups: [],
        courseOfferings: [offering],
        choiceGroups: [],
        enrollments: [],
      });
      const failure = yield* validateSchoolDirectory(structure).pipe(Effect.flip);
      assert.deepInclude(failure, {
        _tag: "Organization.InvalidSchoolDirectory",
        entity: "CourseOffering",
        reason: "WrongSchool",
      });
    }),
  );

  it.effect("rejects a term outside its academic year", () =>
    Effect.gen(function* () {
      const year = academicYear("year-1", "2026-08-01", "2027-07-31");
      const academicTerm = term("term-1", "2026-07-31", "2027-01-31", year.id);
      const structure = SchoolDirectory.make({
        school: School.make({ id: schoolId, name: "School" }),
        subjectCatalog: SubjectCatalog.make({ schoolId, subjects: [] }),
        academicYears: [year],
        terms: [academicTerm],
        cohorts: [],
        departments: [],
        buildings: [],
        rooms: [],
        classGroups: [],
        courseOfferings: [],
        choiceGroups: [],
        enrollments: [],
      });

      const failure = yield* validateSchoolDirectory(structure).pipe(Effect.flip);
      assert.deepInclude(failure, {
        entity: "AcademicTerm",
        entityId: "term-1",
        reason: "OutsideAcademicYear",
      });
    }),
  );

  it.effect("rejects a room whose building is absent from the directory", () =>
    Effect.gen(function* () {
      const room = Room.make({
        id: RoomId.make("room-1"),
        schoolId,
        name: "A1",
        buildingId: BuildingId.make("missing-building"),
      });
      const structure = SchoolDirectory.make({
        school: School.make({ id: schoolId, name: "School" }),
        subjectCatalog: SubjectCatalog.make({ schoolId, subjects: [] }),
        academicYears: [],
        terms: [],
        cohorts: [],
        departments: [],
        buildings: [],
        rooms: [room],
        classGroups: [],
        courseOfferings: [],
        choiceGroups: [],
        enrollments: [],
      });

      const failure = yield* validateSchoolDirectory(structure).pipe(Effect.flip);
      assert.deepInclude(failure, {
        entity: "Room",
        entityId: "room-1",
        reason: "UnknownReference",
      });
    }),
  );
});

describe("course choices and enrollments", () => {
  const firstOffering = CourseOfferingId.make("course-a");
  const secondOffering = CourseOfferingId.make("course-b");
  const group = CourseChoiceGroup.make({
    id: CourseChoiceGroupId.make("choice-1"),
    schoolId,
    termId: AcademicTermId.make("term-1"),
    name: "Choose one language",
    offeringIds: [firstOffering, secondOffering],
    cardinality: { minimum: 1, maximum: 1 },
  });

  it.effect("enforces an exact-one choice rather than an isChoosable flag", () =>
    Effect.gen(function* () {
      const none = yield* Effect.flip(validateCourseChoice(group, []));
      assert.strictEqual(none.reason, "BelowMinimum");

      const tooMany = yield* Effect.flip(
        validateCourseChoice(group, [firstOffering, secondOffering]),
      );
      assert.strictEqual(tooMany.reason, "AboveMaximum");

      assert.deepEqual(yield* validateCourseChoice(group, [secondOffering]), [secondOffering]);
    }),
  );

  it.effect("refuses removal of an enrollment required by academic policy", () =>
    Effect.gen(function* () {
      const enrollment = Enrollment.make({
        id: EnrollmentId.make("enrollment-1"),
        studentMembershipId: SchoolMembershipId.make("student-1"),
        courseOfferingId: firstOffering,
        effective: interval("2026-08-01", "2027-07-31"),
        origin: EnrollmentOrigin.cases.Required.make({}),
      });
      const error = yield* Effect.flip(removeEnrollment([enrollment], enrollment.id, []));
      assert.strictEqual(error._tag, "Organization.EnrollmentNotRemovable");
      assert.strictEqual(error.reason, "Required");
    }),
  );

  it.effect("refuses removal that would violate an exact-one choice", () =>
    Effect.gen(function* () {
      const enrollment = Enrollment.make({
        id: EnrollmentId.make("choice-enrollment"),
        studentMembershipId: SchoolMembershipId.make("student-1"),
        courseOfferingId: firstOffering,
        effective: interval("2026-08-01", "2027-07-31"),
        origin: EnrollmentOrigin.cases.Choice.make({ choiceGroupId: group.id }),
      });
      const error = yield* removeEnrollment([enrollment], enrollment.id, [group]).pipe(Effect.flip);
      assert.strictEqual(error._tag, "Organization.CourseChoiceViolation");
      assert.strictEqual(error.reason, "BelowMinimum");
    }),
  );

  it("suggests a continuation only when the next-term subject match is unambiguous", () => {
    const subjectId = SubjectId.make("mathematics");
    const previous = CourseOffering.make({
      id: firstOffering,
      schoolId,
      termId: AcademicTermId.make("term-1"),
      subjectId,
      name: "Mathematics 8a",
      classGroupIds: [],
    });
    const enrollment = Enrollment.make({
      id: EnrollmentId.make("enrollment-1"),
      studentMembershipId: SchoolMembershipId.make("student-1"),
      courseOfferingId: previous.id,
      effective: interval("2026-08-01", "2027-01-31"),
      origin: EnrollmentOrigin.cases.Optional.make({}),
    });
    const nextTermId = AcademicTermId.make("term-2");
    const next = (id: string) =>
      CourseOffering.make({
        ...previous,
        id: CourseOfferingId.make(id),
        termId: nextTermId,
      });

    expect(
      suggestEnrollmentContinuations({
        previousEnrollments: [enrollment],
        previousOfferings: [previous],
        targetOfferings: [next("next-a"), next("next-b")],
        targetTermId: nextTermId,
      }),
    ).toEqual([]);

    expect(
      suggestEnrollmentContinuations({
        previousEnrollments: [enrollment],
        previousOfferings: [previous],
        targetOfferings: [next("next-a")],
        targetTermId: nextTermId,
      }).map((suggestion) => suggestion.suggestedOfferingId),
    ).toEqual([CourseOfferingId.make("next-a")]);
  });
});
