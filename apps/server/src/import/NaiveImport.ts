/**
 * The baseline M2.2 must beat (m2-import-corpus.md, section 8): one course per subject code and
 * class or cohort, lessons from the class views, no rosters, A and B by ISO week parity. It is
 * wrong on purpose where IGS is hard, and the harness's numbers show where. It reads this week and
 * the next, and deletes only what it read completely.
 */
import { WebUntisClient } from "@schnau/webuntis-api";
import type { TimetableEntry, TimetableEntryDay } from "@schnau/webuntis-api/schemas";
import { CivilTime, Course, School } from "@stu/core";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { SchoolImport } from "./SchoolImport.ts";
import { WebUntisEntry } from "./WebUntisEntry.ts";

export * as NaiveImport from "./NaiveImport.ts";

const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

/** This week and the next, each from Monday to Sunday, labelled A when its ISO week is odd. */
const weeksFrom = Effect.fn("NaiveImport.weeksFrom")(function* (now: DateTime.Utc) {
  const today = CivilTime.dateIn(DateTime.toEpochMillis(now), School.defaultTimeZone);
  const monday = CivilTime.addDays(today, 1 - CivilTime.dayOfWeek(today));

  const week = (offset: number) => {
    const isoWeek = CivilTime.isoWeek(CivilTime.addDays(monday, offset));

    return Effect.all({
      start: encodeDate(CivilTime.addDays(monday, offset)),
      end: encodeDate(CivilTime.addDays(monday, offset + 6)),
      label: Effect.succeed({
        week: isoWeek,
        label: Number(isoWeek.slice(-2)) % 2 === 1 ? "A" : "B",
      }),
    });
  };

  return yield* Effect.all([week(0), week(7)]).pipe(Effect.orDie);
});

const teacherId = (id: number) => `teacher-${id}`;

const roomId = (id: number) => `room-${id}`;

const courseId = (subject: string, group: string) => Course.Id.make(`${subject}/${group}`);

/** Our ids for the names WebUntis gave, through the directory. A name it lacks is dropped. */
const idsFor = (
  names: ReadonlyArray<string>,
  directory: ReadonlyMap<string, number>,
  toId: (id: number) => string,
) =>
  names.flatMap((name) => {
    const id = directory.get(name);

    return id === undefined ? [] : [toId(id)];
  });

const changeKind = (entry: TimetableEntry, status: SchoolImport.LessonStatus) => {
  if (status === "Cancelled") return "Cancelled";

  if (WebUntisEntry.names(entry, "TEACHER").removed.length > 0) return "Substitution";

  return WebUntisEntry.names(entry, "ROOM").removed.length > 0 ? "RoomChange" : "Other";
};

export const layer = Layer.effect(SchoolImport.Service)(
  Effect.gen(function* () {
    const client = yield* WebUntisClient;
    const failed = (reason: string) => () => new SchoolImport.ImportFailed({ reason });

    const run = Effect.fn("NaiveImport.run")(function* (input: SchoolImport.ImportInput) {
      const weeks = yield* weeksFrom(input.now);
      const first = weeks[0].start;
      const last = weeks[1].end;
      const years = yield* client.schoolyears.list.pipe(Effect.mapError(failed("school years")));

      const year = years.find(
        ({ dateRange }) =>
          dateRange.start.slice(0, 10) <= first && first <= dateRange.end.slice(0, 10),
      );

      if (year === undefined) return yield* failed(`no school year holds ${first}`)();

      const yearRange = {
        start: year.dateRange.start.slice(0, 10),
        end: year.dateRange.end.slice(0, 10),
      };

      const directory = (resourceType: "CLASS" | "TEACHER" | "ROOM") =>
        client.timetable
          .getFilter({ resourceType, ...yearRange })
          .pipe(Effect.mapError(failed(`the ${resourceType} directory`)));

      const classIds = (yield* directory("CLASS")).classes.map((each) => each.class.id);
      const teachers = (yield* directory("TEACHER")).teachers.map((each) => each.teacher);
      const rooms = (yield* directory("ROOM")).rooms.map((each) => each.room);

      if (!Arr.isArrayNonEmpty(classIds)) return yield* failed("the school has no classes")();

      const teacherIds = new Map(teachers.map(({ shortName, id }) => [shortName, id]));
      const roomIds = new Map(rooms.map(({ shortName, id }) => [shortName, id]));

      const courses = new Map<string, typeof SchoolImport.ImportedCourse.Type>();
      const lessons: Array<SchoolImport.ImportedLesson> = [];
      const links: Array<typeof SchoolImport.ProviderLink.Type> = [];
      const covers: Array<SchoolImport.Coverage> = [];
      const diagnostics: Array<typeof SchoolImport.Diagnostic.Type> = [];

      /** Adds the entry's lesson, or says it couldn't, which keeps its week uncovered. */
      const addLesson = (day: TimetableEntryDay, entry: TimetableEntry): boolean => {
        const subject = WebUntisEntry.names(entry, "SUBJECT").current[0] ?? "?";
        const course = courseId(subject, day.resource.shortName);
        const date = day.date.slice(0, 10);
        const ids = WebUntisEntry.ids(entry);
        const start = WebUntisEntry.timeOfDay(entry.duration.start);
        const end = WebUntisEntry.timeOfDay(entry.duration.end);

        if (Option.isNone(start) || Option.isNone(end)) {
          diagnostics.push({ code: "unreadable-time", detail: `${date} ${ids.join("+")}` });

          return false;
        }

        const teacherNames = WebUntisEntry.names(entry, "TEACHER");
        const roomNames = WebUntisEntry.names(entry, "ROOM");
        const status = WebUntisEntry.status(entry);
        const id = `${course}/${date}/${ids.join("+")}`;

        courses.set(course, { id: course, name: subject, subject });
        lessons.push({
          id,
          courseId: course,
          date,
          start: start.value,
          end: end.value,
          teacherIds: idsFor(teacherNames.current, teacherIds, teacherId),
          roomIds: idsFor(roomNames.current, roomIds, roomId),
          status,
          change:
            status === "Regular"
              ? undefined
              : {
                  kind: changeKind(entry, status),
                  previousTeacherIds: idsFor(teacherNames.removed, teacherIds, teacherId),
                  previousRoomIds: idsFor(roomNames.removed, roomIds, roomId),
                  text: entry.substitutionText ?? undefined,
                },
        });
        links.push({ id, refs: [SchoolImport.ProviderRef.cases.Entry.make({ date, ids })] });

        return true;
      };

      for (const week of weeks) {
        const range = { start: week.start, end: week.end };

        const results = yield* client.timetable
          .getEntriesForResources({
            resourceType: "CLASS",
            resources: classIds,
            ...range,
          })
          .pipe(Effect.mapError(failed("class timetables")));

        // A read is complete when WebUntis answered, explained nothing with an error, showed every
        // day, and every entry became a lesson. Only then may its week replace stored lessons.
        const unread: Array<number> = [];

        for (const { resource, result } of results) {
          const added = Result.isSuccess(result)
            ? result.success.days.flatMap((day) =>
                day.gridEntries.map((entry) => addLesson(day, entry)),
              )
            : [];

          if (
            Result.isFailure(result) ||
            result.success.errors.length > 0 ||
            !result.success.days.every(WebUntisEntry.shown) ||
            added.includes(false)
          ) {
            unread.push(resource);
          }
        }

        diagnostics.push(
          ...unread.map((resource) => ({
            code: "read-failed",
            detail: `CLASS ${resource} ${range.start}`,
          })),
        );

        if (unread.length === 0) covers.push({ rows: "lessons", ...range });
      }

      const holidays = yield* Effect.option(client.app.getData);

      const closures = Option.match(holidays, {
        onNone: () => {
          diagnostics.push({ code: "read-failed", detail: "app data" });

          return [];
        },
        onSome: (data) => {
          covers.push({ rows: "closures", ...yearRange });

          return data.holidays.map((holiday) => {
            const id = `holiday-${holiday.id}`;

            links.push({
              id,
              refs: [SchoolImport.ProviderRef.cases.Holiday.make({ id: holiday.id })],
            });

            return {
              id,
              name: holiday.name,
              start: holiday.start.slice(0, 10),
              end: holiday.end.slice(0, 10),
            };
          });
        },
      });

      const examList = yield* Effect.option(client.exams.list({ start: first, end: last }));

      const exams = Option.match(examList, {
        onNone: () => {
          diagnostics.push({ code: "read-failed", detail: "exams" });

          return [];
        },
        onSome: (list) => {
          const read = list.exams.flatMap((exam) => {
            const id = `exam-${exam.examId}`;
            const start = WebUntisEntry.timeOfDay(exam.examStart);
            const end = WebUntisEntry.timeOfDay(exam.examEnd);

            if (Option.isNone(start) || Option.isNone(end)) return [];

            links.push({
              id,
              refs: [SchoolImport.ProviderRef.cases.Exam.make({ id: exam.examId })],
            });

            return [
              {
                id,
                courseId: courseId(exam.subject.shortName, exam.classes[0]?.shortName ?? "?"),
                date: exam.examStart.slice(0, 10),
                start: start.value,
                end: end.value,
              },
            ];
          });

          // An exam whose time didn't read would otherwise be deleted with nothing in its place.
          if (read.length === list.exams.length)
            covers.push({ rows: "exams", start: first, end: last });

          return read;
        },
      });

      return {
        courses: [...courses.values()],
        lessons,
        closures,
        exams,
        teachers: teachers.map(({ id, shortName }) => ({ id: teacherId(id), shortName })),
        rooms: rooms.map(({ id, shortName }) => ({ id: roomId(id), name: shortName })),
        weeks: weeks.map(({ label }) => label),
        links: [
          ...links,
          ...teachers.map(({ id }) => ({
            id: teacherId(id),
            refs: [SchoolImport.ProviderRef.cases.Resource.make({ type: "TEACHER", id })],
          })),
          ...rooms.map(({ id }) => ({
            id: roomId(id),
            refs: [SchoolImport.ProviderRef.cases.Resource.make({ type: "ROOM", id })],
          })),
        ],
        covers,
        diagnostics,
      } satisfies SchoolImport.ImportResult;
    });

    return SchoolImport.Service.of({ run });
  }),
);
