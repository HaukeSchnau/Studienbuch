import {
  collectSnapshotClasses,
  collectSnapshotPersons,
  collectSnapshotSchools,
  collectSnapshotSemesters,
  collectSnapshotYears,
  type SnapshotResponse,
} from "@stu/lib";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export const applySnapshotToLocalDatabase = Effect.fn(function* (snapshot: SnapshotResponse) {
  const db = yield* Database;

  const schools = collectSnapshotSchools(snapshot);
  const years = collectSnapshotYears(snapshot);
  const classes = collectSnapshotClasses(snapshot);
  const semesters = collectSnapshotSemesters(snapshot);
  const persons = collectSnapshotPersons(snapshot);

  for (const school of schools) {
    yield* db.execute((client) =>
      client
        .insert(tables.schools)
        .values({
          id: school.id,
          name: school.name,
          stateCode: school.stateCode,
        })
        .onConflictDoUpdate({
          target: [tables.schools.id],
          set: {
            name: school.name,
            stateCode: school.stateCode,
          },
        }),
    );
  }

  for (const year of years) {
    yield* db.execute((client) =>
      client
        .insert(tables.years)
        .values({
          name: year.name,
          startYear: year.startYear,
          graduationYear: year.graduationYear,
          school: year.school,
        })
        .onConflictDoUpdate({
          target: [tables.years.startYear, tables.years.school],
          set: {
            name: year.name,
            graduationYear: year.graduationYear,
          },
        }),
    );
  }

  for (const cls of classes) {
    yield* db.execute((client) =>
      client
        .insert(tables.classes)
        .values({
          identifierInYear: cls.identifierInYear,
          startYear: cls.startYear,
          school: cls.school,
        })
        .onConflictDoNothing(),
    );
  }

  for (const semester of semesters) {
    yield* db.execute((client) =>
      client
        .insert(tables.semesters)
        .values({
          name: semester.name,
          start: new Date(semester.start),
          end: new Date(semester.end),
          school: semester.school,
          type: semester.type,
          year: semester.year,
        })
        .onConflictDoUpdate({
          target: [tables.semesters.school, tables.semesters.type, tables.semesters.year],
          set: {
            name: semester.name,
            start: new Date(semester.start),
            end: new Date(semester.end),
          },
        }),
    );
  }

  for (const person of persons) {
    yield* db.execute((client) =>
      client
        .insert(tables.persons)
        .values({
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          salutation: person.salutation,
          abbrv: person.abbrv,
        })
        .onConflictDoUpdate({
          target: [tables.persons.id],
          set: {
            firstName: person.firstName,
            lastName: person.lastName,
            salutation: person.salutation,
            abbrv: person.abbrv,
          },
        }),
    );
  }

  for (const student of snapshot.students) {
    yield* db.execute((client) =>
      client
        .insert(tables.students)
        .values({
          person: student.id,
          school: student.school.id,
          startYear: student.class.startYear,
          classIdentifier: student.class.identifierInYear,
          isOfAge: student.isOfAge,
        })
        .onConflictDoUpdate({
          target: [tables.students.person],
          set: {
            school: student.school.id,
            startYear: student.class.startYear,
            classIdentifier: student.class.identifierInYear,
            isOfAge: student.isOfAge,
          },
        }),
    );
  }

  for (const course of snapshot.courses) {
    yield* db.execute((client) =>
      client
        .insert(tables.courses)
        .values({
          id: course.id,
          name: course.name,
          subject: course.subject,
          school: course.school.id,
          semesterType: course.semester.type,
          semesterYear: course.semester.year,
          isMandatory: course.isMandatory,
          isMember: true,
        })
        .onConflictDoUpdate({
          target: [tables.courses.id],
          set: {
            name: course.name,
            subject: course.subject,
            school: course.school.id,
            semesterType: course.semester.type,
            semesterYear: course.semester.year,
            isMandatory: course.isMandatory,
            isMember: true,
          },
        }),
    );

    for (const courseClass of course.classes) {
      yield* db.execute((client) =>
        client
          .insert(tables.coursesToClasses)
          .values({
            course: course.id,
            school: courseClass.school,
            classIdentifier: courseClass.identifierInYear,
            classStartYear: courseClass.startYear,
          })
          .onConflictDoNothing(),
      );
    }

    for (const teacher of course.teachers) {
      yield* db.execute((client) =>
        client
          .insert(tables.coursesToTeachers)
          .values({
            course: course.id,
            teacher: teacher.id,
          })
          .onConflictDoNothing(),
      );
    }
  }

  for (const absence of snapshot.absences) {
    const date = new Date(absence.date);
    yield* db.execute((client) =>
      client
        .insert(tables.absenceDays)
        .values({
          date,
          reason: absence.reason,
          parentSignature: absence.parentSignature,
        })
        .onConflictDoUpdate({
          target: [tables.absenceDays.date],
          set: {
            reason: absence.reason,
            parentSignature: absence.parentSignature,
          },
        }),
    );

    for (const courseAbsence of absence.courses) {
      yield* db.execute((client) =>
        client
          .insert(tables.courseAbsences)
          .values({
            date,
            course: courseAbsence.courseId,
            teacherSignature: courseAbsence.teacherSignature,
          })
          .onConflictDoUpdate({
            target: [tables.courseAbsences.date, tables.courseAbsences.course],
            set: {
              teacherSignature: courseAbsence.teacherSignature,
            },
          }),
      );
    }
  }

  for (const grade of snapshot.grades) {
    yield* db.execute((client) =>
      client
        .insert(tables.grades)
        .values({
          date: new Date(grade.date),
          result: grade.result,
          type: grade.type,
          course: grade.course,
          teacherSignature: grade.teacherSignature,
          parentSignature: grade.parentSignature,
        })
        .onConflictDoUpdate({
          target: [tables.grades.date, tables.grades.course, tables.grades.type],
          set: {
            result: grade.result,
            teacherSignature: grade.teacherSignature,
            parentSignature: grade.parentSignature,
          },
        }),
    );
  }
});
