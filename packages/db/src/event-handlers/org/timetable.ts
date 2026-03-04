import { ValidationError } from "@groundswell/core";
import { CourseRepository, studentsOfCourse } from "@stu/lib";
import { Effect } from "effect";
import { TimetableRepository } from "../../repositories/timetable.repo";
import { verifySystemInitiator } from "./context";
import type { OrgApplicatorMap } from "./types";

export const timetableApplicators: Pick<
  OrgApplicatorMap,
  "timetable.entryCreated" | "timetable.substituted" | "timetable.canceled" | "timetable.discarded"
> = {
  "timetable.entryCreated": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        const courseRepo = yield* Effect.service(CourseRepository);
        const existingCourse = yield* courseRepo.getCourse({ id: event.data.course });
        if (!existingCourse) {
          return yield* Effect.fail(new ValidationError({ cause: "COURSE_NOT_FOUND", reason: "NOT_FOUND" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* Effect.service(TimetableRepository);
        yield* timetableRepo.upsertTimetableEntry({
          course: event.data.course,
          start: event.data.start,
          duration: event.data.duration,
          rooms: event.data.rooms,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
  "timetable.substituted": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        const timetableRepo = yield* Effect.service(TimetableRepository);
        if (
          yield* timetableRepo.getSubstitution({
            course: event.data.course,
            start: event.data.start,
            originalTeacher: event.data.originalTeacher,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* Effect.service(TimetableRepository);
        yield* timetableRepo.createSubstitution({
          course: event.data.course,
          start: event.data.start,
          originalTeacher: event.data.originalTeacher,
          substitute: event.data.substitute,
          type: "VERTRETUNG",
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
  "timetable.canceled": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        const timetableRepo = yield* Effect.service(TimetableRepository);
        if (
          yield* timetableRepo.getSubstitution({
            course: event.data.course,
            start: event.data.start,
            originalTeacher: event.data.originalTeacher,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* Effect.service(TimetableRepository);
        yield* timetableRepo.createSubstitution({
          course: event.data.course,
          start: event.data.start,
          originalTeacher: event.data.originalTeacher,
          type: "ENTFALL",
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
  "timetable.discarded": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        const timetableRepo = yield* Effect.service(TimetableRepository);
        if (
          !(yield* timetableRepo.getTimetableEntry({
            course: event.data.course,
            start: event.data.start,
          }))
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "DOES_NOT_EXIST", reason: "NOT_FOUND" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* Effect.service(TimetableRepository);
        yield* timetableRepo.deleteTimetableEntry({
          course: event.data.course,
          start: event.data.start,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
};
