import { mapStudentWithPersonRowToStudent, type SchoolId, type StudentId } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer, ServiceMap } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class StudentRepository extends ServiceMap.Service<StudentRepository>()("student/StudentRepository", {
  make: Effect.gen(function* () {
    const doesClassExist = Effect.fn(function* (payload: { identifier: string; startYear: number; school: SchoolId }) {
      const { execute } = yield* Effect.service(Database);

      const cls = yield* execute((db) =>
        db
          .select()
          .from(tables.Classes)
          .where(
            and(
              eq(tables.Classes.identifierInYear, payload.identifier),
              eq(tables.Classes.startYear, payload.startYear),
              eq(tables.Classes.school, payload.school),
            ),
          ),
      );

      return cls.length > 0;
    });

    const getSchoolOfUser = Effect.fn(function* (payload: { studentId: StudentId }) {
      const { execute } = yield* Effect.service(Database);

      const rows = yield* execute((db) =>
        db
          .select({
            school: tables.Schools.id,
          })
          .from(tables.Schools)
          .innerJoin(tables.LicenseKeys, eq(tables.LicenseKeys.school, tables.Schools.id))
          .where(eq(tables.LicenseKeys.activatedBy, payload.studentId)),
      );

      return rows[0]?.school;
    });

    const createStudent = Effect.fn(function* (payload: {
      studentId: StudentId;
      firstName: string;
      lastName: string;
      school: SchoolId;
      class: {
        identifier: string;
        startYear: number;
      };
      isOfAge: boolean;
    }) {
      const { execute } = yield* Effect.service(Database);

      yield* execute((db) =>
        db
          .insert(tables.Persons)
          .values({
            id: payload.studentId,
            firstName: payload.firstName,
            lastName: payload.lastName,
          })
          .onConflictDoUpdate({
            target: [tables.Persons.id],
            set: {
              firstName: payload.firstName,
              lastName: payload.lastName,
            },
          }),
      );

      yield* execute((db) =>
        db
          .insert(tables.Students)
          .values({
            person: payload.studentId,
            school: payload.school,
            startYear: payload.class.startYear,
            classIdentifier: payload.class.identifier,
            isOfAge: payload.isOfAge,
          })
          .onConflictDoUpdate({
            target: [tables.Students.person],
            set: {
              school: payload.school,
              startYear: payload.class.startYear,
              classIdentifier: payload.class.identifier,
              isOfAge: payload.isOfAge,
            },
          }),
      );
    }, Database.asTransaction);

    const doesCourseExist = Effect.fn(function* (payload: { courseId: string }) {
      const { execute } = yield* Effect.service(Database);

      const course = yield* execute((db) =>
        db.select().from(tables.Courses).where(eq(tables.Courses.id, payload.courseId)),
      );

      return course.length > 0;
    });

    const isAssignedToCourse = Effect.fn(function* (payload: { studentId: StudentId; courseId: string }) {
      const { execute } = yield* Effect.service(Database);

      const assignment = yield* execute((db) =>
        db.query.CourseMemberships.findFirst({
          where: and(
            eq(tables.CourseMemberships.student, payload.studentId),
            eq(tables.CourseMemberships.course, payload.courseId),
          ),
        }),
      );

      return !!assignment;
    });

    const assignCourse = Effect.fn(function* (payload: { studentId: StudentId; courseId: string }) {
      const { execute } = yield* Effect.service(Database);

      yield* execute((db) =>
        db.insert(tables.CourseMemberships).values({
          student: payload.studentId,
          course: payload.courseId,
        }),
      );
    });

    const getStudent = Effect.fn(function* (payload: { studentId: StudentId }) {
      const { execute } = yield* Effect.service(Database);

      const student = yield* execute((db) =>
        db.query.Students.findFirst({
          where: eq(tables.Students.person, payload.studentId),
          with: {
            person: true,
          },
        }),
      );

      if (!student) {
        return undefined;
      }

      return mapStudentWithPersonRowToStudent(student);
    });

    return {
      doesClassExist,
      getSchoolOfUser,
      doesCourseExist,
      isAssignedToCourse,
      createStudent,
      assignCourse,
      getStudent,
    };
  }),
}) {
  static readonly Default = Layer.effect(StudentRepository, StudentRepository.make);
}
