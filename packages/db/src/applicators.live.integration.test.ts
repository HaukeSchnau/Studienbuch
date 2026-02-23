import { randomUUID } from "node:crypto";
import { type DomainEvent, defaultTheme } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "../testing/client";
import * as schema from "./schema";

const school = "igs-lil";
const classIdentifier = "Q1";
const startYear = 2026;
const semesterYear = 2026;

const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const courseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const missingCourseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const joinedStudentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const teacherId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const missingTimetableCourseId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const orgInitiatorId = "00000000-0000-0000-0000-000000000000";

const loadDbModules = async () => {
  const modules = await import("./index");

  const repositories = Layer.mergeAll(
    modules.AuthRepositoryLive,
    modules.SchoolRepositoryLive,
    modules.PersonRepository.Default,
    modules.YearRepositoryLive,
    modules.ClassRepositoryLive,
    modules.CourseRepositoryLive,
    modules.HolidayRepositoryLive,
    modules.StudentRepository.Default,
    modules.GradeRepositoryDb.Default,
    modules.AbsenceRepositoryDb.Default,
    modules.TimetableRepository.Default,
    modules.SemesterRepositoryLive,
  );

  const provideLiveDb = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provide(repositories), Effect.provide(modules.DatabaseLive));

  return {
    ...modules,
    provideLiveDb,
  };
};

const absenceRecorded = (courseIds: string[]): Extract<DomainEvent, { type: "absence.recorded" }> => ({
  id: randomUUID(),
  timestamp: new Date("2026-01-10T00:00:00.000Z"),
  type: "absence.recorded",
  data: {
    studentId,
    date: new Date("2026-01-10T00:00:00.000Z"),
    reason: "Krank",
    courseIds,
  },
});

describe("live postgres applicator integration", () => {
  let dbClient: Awaited<ReturnType<typeof createClient>>["client"];
  let db: Awaited<ReturnType<typeof createClient>>["db"];
  let dbModules: Awaited<ReturnType<typeof loadDbModules>>;

  beforeAll(async () => {
    const databaseUrl = process.env.MANAGEMENT_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("MANAGEMENT_DATABASE_URL is required for live database tests");
    }

    const liveClient = await createClient(databaseUrl);
    dbClient = liveClient.client;
    db = liveClient.db;
    dbModules = await loadDbModules();
  });

  afterAll(async () => {
    await dbClient.end();
  });

  const seedSchoolGraph = async () => {
    await db.insert(schema.Schools).values({
      id: school,
      name: "IGS Lilienthal",
      image: "",
      theme: defaultTheme,
      stateCode: "NI",
      kadmosName: "k",
      kadmosUsername: "u",
      kadmosPassword: "p",
    });

    await db.insert(schema.Years).values({
      school,
      name: "Q1",
      startYear,
      graduationYear: 2027,
    });

    await db.insert(schema.Classes).values({
      identifierInYear: classIdentifier,
      startYear,
      school,
    });

    await db.insert(schema.Semesters).values({
      school,
      type: "WINTER",
      year: semesterYear,
      name: "Winter 2026",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-07-01T00:00:00.000Z"),
    });
  };

  const seedStudent = async () => {
    await db.insert(schema.Persons).values({
      id: studentId,
      firstName: "Ada",
      lastName: "Lovelace",
    });

    await db.insert(schema.Students).values({
      person: studentId,
      classIdentifier,
      startYear,
      school,
      isOfAge: false,
    });
  };

  const seedCourse = async () => {
    await db.insert(schema.Courses).values({
      id: courseId,
      name: "Mathematik",
      subject: "ma",
      school,
      semesterType: "WINTER",
      semesterYear,
      isMandatory: true,
    });
  };

  test("absence.recorded persists both absence tables against live postgres", async () => {
    await seedSchoolGraph();
    await seedStudent();
    await seedCourse();

    const event = absenceRecorded([courseId]);
    const meta = { initiatorId: studentId } as never;

    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.verify(event, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.apply(event, meta)));

    const days = await db
      .select()
      .from(schema.AbsenceDays)
      .where(and(eq(schema.AbsenceDays.student, studentId), eq(schema.AbsenceDays.date, event.data.date)));
    const courseAbsences = await db
      .select()
      .from(schema.CourseAbsences)
      .where(
        and(
          eq(schema.CourseAbsences.student, studentId),
          eq(schema.CourseAbsences.date, event.data.date),
          eq(schema.CourseAbsences.course, courseId),
        ),
      );

    expect(days).toHaveLength(1);
    expect(courseAbsences).toHaveLength(1);
  });

  test("absence.recorded rolls back absence_days when course insert fails", async () => {
    await seedSchoolGraph();
    await seedStudent();

    const event = absenceRecorded([missingCourseId]);
    const meta = { initiatorId: studentId } as never;

    const result = await Effect.runPromise(
      Effect.either(dbModules.provideLiveDb(dbModules.applicators.apply(event, meta))),
    );

    expect(result._tag).toBe("Left");

    const days = await db
      .select()
      .from(schema.AbsenceDays)
      .where(and(eq(schema.AbsenceDays.student, studentId), eq(schema.AbsenceDays.date, event.data.date)));

    expect(days).toHaveLength(0);
  });

  test("student.joined rolls back person insert when class foreign key fails", async () => {
    await db.insert(schema.Schools).values({
      id: school,
      name: "IGS Lilienthal",
      image: "",
      theme: defaultTheme,
      stateCode: "NI",
      kadmosName: "k",
      kadmosUsername: "u",
      kadmosPassword: "p",
    });

    await db.insert(schema.Years).values({
      school,
      name: "Q1",
      startYear,
      graduationYear: 2027,
    });

    const event: Extract<DomainEvent, { type: "student.joined" }> = {
      id: randomUUID(),
      timestamp: new Date("2026-01-11T00:00:00.000Z"),
      type: "student.joined",
      data: {
        studentId: joinedStudentId,
        name: "Transaction Rollback",
        school,
        isOfAge: true,
        class: {
          identifier: "MISSING",
          startYear,
        },
      },
    };

    const meta = { initiatorId: joinedStudentId } as never;
    const result = await Effect.runPromise(
      Effect.either(dbModules.provideLiveDb(dbModules.applicators.apply(event, meta))),
    );

    expect(result._tag).toBe("Left");

    const persons = await db.select().from(schema.Persons).where(eq(schema.Persons.id, joinedStudentId));
    const students = await db.select().from(schema.Students).where(eq(schema.Students.person, joinedStudentId));

    expect(persons).toHaveLength(0);
    expect(students).toHaveLength(0);
  });

  test("org course + timetable lifecycle persists and discards entries", async () => {
    await seedSchoolGraph();

    const teacherJoined: Extract<DomainEvent, { type: "org.teacher.joined" }> = {
      id: randomUUID(),
      timestamp: new Date("2026-01-12T08:00:00.000Z"),
      type: "org.teacher.joined",
      data: {
        personId: teacherId,
        firstName: "Marie",
        lastName: "Curie",
        abbrv: "MC",
        salutation: "Frau",
        school,
      },
    };

    const courseCreated: Extract<DomainEvent, { type: "org.courses.created" }> = {
      id: randomUUID(),
      timestamp: new Date("2026-01-12T08:05:00.000Z"),
      type: "org.courses.created",
      data: {
        id: courseId,
        name: "Mathematik",
        subject: "ma",
        isMandatory: true,
        school,
        semester: {
          type: "WINTER",
          year: semesterYear,
        },
        classes: [
          {
            identifierInYear: classIdentifier,
            startYear,
          },
        ],
        teachers: [teacherId],
      },
    };

    const entryCreated: Extract<DomainEvent, { type: "org.timetable.entryCreated" }> = {
      id: randomUUID(),
      timestamp: new Date("2026-01-12T08:10:00.000Z"),
      type: "org.timetable.entryCreated",
      data: {
        course: courseId,
        start: new Date("2026-01-12T10:00:00.000Z"),
        duration: 45,
        rooms: ["A101"],
      },
    };

    const entryDiscarded: Extract<DomainEvent, { type: "org.timetable.discarded" }> = {
      id: randomUUID(),
      timestamp: new Date("2026-01-12T08:20:00.000Z"),
      type: "org.timetable.discarded",
      data: {
        course: courseId,
        start: entryCreated.data.start,
      },
    };

    const meta = { initiatorId: orgInitiatorId } as never;

    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.verify(teacherJoined, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.apply(teacherJoined, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.verify(courseCreated, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.apply(courseCreated, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.verify(entryCreated, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.apply(entryCreated, meta)));

    const courses = await db.select().from(schema.Courses).where(eq(schema.Courses.id, courseId));
    const courseTeachers = await db
      .select()
      .from(schema.CoursesToTeachers)
      .where(and(eq(schema.CoursesToTeachers.course, courseId), eq(schema.CoursesToTeachers.teacher, teacherId)));
    const timetableEntriesAfterCreate = await db
      .select()
      .from(schema.TimetableEntries)
      .where(
        and(
          eq(schema.TimetableEntries.course, courseId),
          eq(schema.TimetableEntries.start, entryCreated.data.start),
        ),
      );

    expect(courses).toHaveLength(1);
    expect(courseTeachers).toHaveLength(1);
    expect(timetableEntriesAfterCreate).toHaveLength(1);
    expect(timetableEntriesAfterCreate[0]?.duration).toBe(45);
    expect(timetableEntriesAfterCreate[0]?.rooms).toEqual(["A101"]);

    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.verify(entryDiscarded, meta)));
    await Effect.runPromise(dbModules.provideLiveDb(dbModules.applicators.apply(entryDiscarded, meta)));

    const timetableEntriesAfterDiscard = await db
      .select()
      .from(schema.TimetableEntries)
      .where(
        and(
          eq(schema.TimetableEntries.course, courseId),
          eq(schema.TimetableEntries.start, entryCreated.data.start),
        ),
      );

    expect(timetableEntriesAfterDiscard).toHaveLength(0);
  });

  test("org.timetable.discarded verify rejects missing timetable entries", async () => {
    const event: Extract<DomainEvent, { type: "org.timetable.discarded" }> = {
      id: randomUUID(),
      timestamp: new Date("2026-01-13T10:00:00.000Z"),
      type: "org.timetable.discarded",
      data: {
        course: missingTimetableCourseId,
        start: new Date("2026-01-13T10:00:00.000Z"),
      },
    };
    const meta = { initiatorId: orgInitiatorId } as never;

    const result = await Effect.runPromise(
      Effect.either(dbModules.provideLiveDb(dbModules.applicators.verify(event, meta))),
    );

    expect(result._tag).toBe("Left");
  });
});
