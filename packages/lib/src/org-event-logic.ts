import { Effect } from "effect";
import type { DomainEvent } from "./events";
import { CourseRepository, HolidayRepository, SchoolRepository } from "./repositories";
import { Semester } from "./semesters";
import { YearRepository } from "./year";

type OrgSchoolFoundedData = Extract<DomainEvent, { type: "org.school.founded" }>["data"];
type OrgHolidayCreatedData = Extract<DomainEvent, { type: "org.holiday.created" }>["data"];
type OrgYearStartedData = Extract<DomainEvent, { type: "org.year.started" }>["data"];
type OrgCoursesCreatedData = Extract<DomainEvent, { type: "org.courses.created" }>["data"];

const failIfTrue =
  <E>(onTrue: () => E) =>
  (value: boolean): Effect.Effect<void, E> =>
    value ? Effect.fail(onTrue()) : Effect.void;

export const verifyOrgSchoolFounded = <E>(options: { data: OrgSchoolFoundedData; onDuplicate: () => E }) =>
  Effect.andThen(SchoolRepository, (repo) =>
    repo.doesSchoolExist({
      id: options.data.id,
    }),
  ).pipe(Effect.flatMap(failIfTrue(options.onDuplicate)));

export const applyOrgSchoolFounded = (options: { data: OrgSchoolFoundedData }) =>
  Effect.andThen(SchoolRepository, (repo) =>
    repo.createSchool({
      id: options.data.id,
      name: options.data.name,
      state: options.data.state,
    }),
  );

export const verifyOrgHolidayCreated = <E>(options: { data: OrgHolidayCreatedData; onDuplicate: () => E }) =>
  Effect.andThen(HolidayRepository, (repo) =>
    repo.doesHolidayExist({
      name: options.data.name,
      state: options.data.state,
      year: options.data.year,
    }),
  ).pipe(Effect.flatMap(failIfTrue(options.onDuplicate)));

export const applyOrgHolidayCreated = (options: { data: OrgHolidayCreatedData }) =>
  Effect.gen(function* () {
    const holidayRepo = yield* HolidayRepository;
    yield* holidayRepo.createHoliday({
      name: options.data.name,
      start: options.data.start,
      end: options.data.end,
      state: options.data.state,
      year: options.data.year,
    });

    yield* Semester.inferSemesters(options.data.state);
  });

export const verifyOrgYearStarted = <E>(options: { data: OrgYearStartedData; onDuplicate: () => E }) =>
  Effect.andThen(YearRepository, (repo) =>
    repo.doesYearExist({
      startYear: options.data.startYear,
      school: options.data.school,
    }),
  ).pipe(Effect.flatMap(failIfTrue(options.onDuplicate)));

export const applyOrgYearStarted = (options: { data: OrgYearStartedData }) =>
  Effect.andThen(YearRepository, (repo) =>
    repo.createYear({
      name: options.data.name,
      startYear: options.data.startYear,
      graduationYear: options.data.graduationYear,
      school: options.data.school,
      classes: options.data.classes,
    }),
  );

export const verifyOrgCoursesCreated = <E>(options: { data: OrgCoursesCreatedData; onDuplicate: () => E }) =>
  Effect.andThen(CourseRepository, (repo) =>
    repo.doesCourseExist({
      id: options.data.id,
    }),
  ).pipe(Effect.flatMap(failIfTrue(options.onDuplicate)));

export const applyOrgCoursesCreated = (options: { data: OrgCoursesCreatedData }) =>
  Effect.andThen(CourseRepository, (repo) =>
    repo.createCourse({
      id: options.data.id,
      name: options.data.name,
      subject: options.data.subject,
      school: options.data.school,
      semester: options.data.semester,
      isMandatory: options.data.isMandatory,
      teachers: options.data.teachers,
      classes: options.data.classes,
    }),
  );
