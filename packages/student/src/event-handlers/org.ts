import type { DomainEvent } from "@stu/lib";

import { ValidationError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import type { GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import { Effect } from "effect";
import { OrgRepository } from "./org.repo";

const failIfTrue = (message: string) =>
  Effect.flatMap((bool) => (bool ? Effect.fail(new ValidationError({ cause: message })) : Effect.void));

export const orgApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "org",
  DatabaseError<GenericSqliteError>,
  Database | OrgRepository
> = {
  "school.founded": {
    verify: (event) =>
      OrgRepository.use((repo) =>
        repo.doesSchoolExist({
          id: event.data.id,
        }),
      ).pipe(failIfTrue("School already exists")),
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createSchool({
          id: event.data.id,
          name: event.data.name,
          state: event.data.state,
        }),
      ),
  },

  "teacher.joined": {
    verify: (event) =>
      OrgRepository.use((repo) =>
        repo.doesTeacherExist({
          id: event.data.personId,
        }),
      ).pipe(failIfTrue("Teacher already exists")),
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createTeacher({
          personId: event.data.personId,
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          salutation: event.data.salutation,
          abbrv: event.data.abbrv,
        }),
      ),
  },

  "holiday.created": {
    verify: (event) =>
      OrgRepository.use((repo) =>
        repo.doesHolidayExist({
          name: event.data.name,
          start: event.data.start,
          end: event.data.end,
          state: event.data.state,
          year: event.data.year,
        }),
      ).pipe(failIfTrue("Holiday already exists")),
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createHoliday({
          name: event.data.name,
          start: event.data.start,
          end: event.data.end,
          state: event.data.state,
          year: event.data.year,
        }),
      ),
  },

  "year.started": {
    verify: (event) =>
      OrgRepository.use((repo) =>
        repo.doesYearExist({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
        }),
      ).pipe(failIfTrue("Year already exists")),
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createYear({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
          classes: event.data.classes,
        }),
      ),
  },

  "courses.created": {
    verify: (event) =>
      OrgRepository.use((repo) =>
        repo.doesCourseExist({
          id: event.data.id,
        }),
      ).pipe(failIfTrue("Course already exists")),
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createCourse({
          id: event.data.id,
          name: event.data.name,
          subject: event.data.subject,
          school: event.data.school,
          semester: event.data.semester,
          isMandatory: event.data.isMandatory,
          teachers: event.data.teachers,
          classes: event.data.classes,
        }),
      ),
  },

  "timetable.entryCreated": {
    verify: (event) =>
      OrgRepository.use((repo) =>
        repo.doesTimetableEntryExist({
          start: event.data.start,
          course: event.data.course,
        }),
      ).pipe(failIfTrue("Timetable entry already exists")),
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createTimetableEntry({
          start: event.data.start,
          duration: event.data.duration,
          course: event.data.course,
          rooms: event.data.rooms,
        }),
      ),
  },

  "timetable.substituted": {
    verify: () => Effect.void,
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createSubstitution({
          start: event.data.start,
          course: event.data.course,
          substitute: event.data.substitute,
          type: "VERTRETUNG",
        }),
      ),
  },

  "timetable.canceled": {
    verify: () => Effect.void,
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.createSubstitution({
          start: event.data.start,
          course: event.data.course,
          substitute: null,
          type: "ENTFALL",
        }),
      ),
  },

  "timetable.discarded": {
    verify: () => Effect.void,
    apply: (event) =>
      OrgRepository.use((repo) =>
        repo.deleteTimetableEntry({
          start: event.data.start,
          course: event.data.course,
        }),
      ),
  },
};
