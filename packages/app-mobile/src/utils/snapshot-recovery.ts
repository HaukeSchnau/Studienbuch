import type { ApplicatorError } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import { type DomainEvent, type SnapshotRequest, type SnapshotResponse, SnapshotResponseSchema } from "@stu/lib";
import { Database } from "@stu/student";
import * as tables from "@stu/student/schema";
import { Data, Effect, Either } from "effect";

export class SnapshotRecoveryError extends Data.TaggedError("SnapshotRecoveryError")<{
  cause: unknown;
}> {}

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): T[] => {
  const deduped = new Map<string, T>();
  for (const item of items) {
    deduped.set(key(item), item);
  }
  return [...deduped.values()];
};

const schoolFromStudent = (student: SnapshotResponse["students"][number]) => student.school;
const schoolFromCourse = (course: SnapshotResponse["courses"][number]) => course.school;

export const snapshotEntitiesForEvent = (event: DomainEvent): SnapshotRequest["entities"] => {
  switch (event.type) {
    case "absence.recorded":
      return uniqueBy(
        [
          {
            kind: "student",
            id: event.data.studentId,
          },
          ...event.data.courseIds.map((courseId) => ({
            kind: "course" as const,
            id: courseId,
          })),
        ],
        (entity) => `${entity.kind}:${entity.id}`,
      );
    case "absence.teacherApproved":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
        {
          kind: "course",
          id: event.data.courseId,
        },
      ];
    case "absence.discarded":
      return uniqueBy(
        [
          {
            kind: "student",
            id: event.data.studentId,
          },
          ...event.data.courseIds.map((courseId) => ({
            kind: "course" as const,
            id: courseId,
          })),
        ],
        (entity) => `${entity.kind}:${entity.id}`,
      );
    case "grades.currentGradeSet":
    case "grades.writtenGradeRecorded":
    case "student.courseAssigned":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
        {
          kind: "course",
          id: event.data.courseId,
        },
      ];
    case "grades.teacherApproved":
    case "grades.parentApproved":
    case "grades.discarded":
    case "grades.latestRestored":
      return [
        {
          kind: "student",
          id: event.data.studentId,
        },
        {
          kind: "course",
          id: event.data.course,
        },
      ];
    default:
      return [];
  }
};

const isMissingReferenceError = (
  event: DomainEvent,
  error: DatabaseError<GenericSqliteError> | ApplicatorError,
): boolean => {
  if (error._tag === "DatabaseError") {
    return error.type === "foreign_key_violation";
  }

  if (
    error._tag === "ApplicatorError" &&
    "studentId" in event.data &&
    typeof event.data.studentId === "string" &&
    typeof error.cause === "string"
  ) {
    return error.cause === `Student ${event.data.studentId} not found`;
  }

  return false;
};

export const applySnapshotToLocalDatabase = Effect.fn(function* (snapshot: SnapshotResponse) {
  const db = yield* Database;

  const schools = uniqueBy(
    [...snapshot.students.map(schoolFromStudent), ...snapshot.courses.map(schoolFromCourse)],
    (school) => school.id,
  );
  const years = uniqueBy(
    snapshot.students.map((student) => student.year),
    (year) => `${year.school}:${year.startYear}`,
  );
  const classes = uniqueBy(
    snapshot.students.map((student) => student.class),
    (cls) => `${cls.school}:${cls.startYear}:${cls.identifierInYear}`,
  );
  const semesters = uniqueBy(
    snapshot.courses.map((course) => course.semester),
    (semester) => `${semester.school}:${semester.type}:${semester.year}`,
  );
  const persons = uniqueBy(
    [...snapshot.students, ...snapshot.courses.flatMap((course) => course.teachers)].map((person) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      salutation: "salutation" in person ? person.salutation : null,
      abbrv: "abbrv" in person ? person.abbrv : null,
    })),
    (person) => person.id,
  );

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
  }
});

export const fetchSnapshotFromApi = Effect.fn(function* (options: {
  baseUrl: string;
  headers: Record<string, string>;
  request: SnapshotRequest;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = options.fetchFn ?? fetch;

  const response = yield* Effect.tryPromise({
    try: () =>
      fetchFn(`${options.baseUrl}/api/snapshot`, {
        method: "POST",
        headers: {
          ...options.headers,
          "content-type": "application/json",
        },
        body: JSON.stringify(options.request),
      }),
    catch: (cause) => new SnapshotRecoveryError({ cause }),
  });

  if (!response.ok) {
    return yield* Effect.fail(
      new SnapshotRecoveryError({
        cause: `Snapshot request failed with status ${response.status}`,
      }),
    );
  }

  const body = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new SnapshotRecoveryError({ cause }),
  });

  const snapshot = SnapshotResponseSchema.safeParse(body);
  if (!snapshot.success) {
    return yield* Effect.fail(new SnapshotRecoveryError({ cause: snapshot.error }));
  }

  return snapshot.data;
});

export const applyEventWithSnapshotRecovery = <RApply, RFetch, RApplySnapshot>(options: {
  event: DomainEvent;
  applyEvent: (event: DomainEvent) => Effect.Effect<void, DatabaseError<GenericSqliteError> | ApplicatorError, RApply>;
  fetchSnapshot: (request: SnapshotRequest) => Effect.Effect<SnapshotResponse, SnapshotRecoveryError, RFetch>;
  applySnapshot: (snapshot: SnapshotResponse) => Effect.Effect<void, DatabaseError<GenericSqliteError>, RApplySnapshot>;
}) =>
  Effect.gen(function* () {
    const initialResult = yield* options.applyEvent(options.event).pipe(Effect.either);
    if (Either.isRight(initialResult)) {
      return;
    }

    const error = initialResult.left;
    if (!isMissingReferenceError(options.event, error)) {
      return yield* Effect.fail(error);
    }

    const entities = snapshotEntitiesForEvent(options.event);
    if (entities.length === 0) {
      return yield* Effect.fail(error);
    }

    const snapshot = yield* options.fetchSnapshot({
      entities,
    });

    yield* options.applySnapshot(snapshot);

    return yield* options.applyEvent(options.event);
  });
