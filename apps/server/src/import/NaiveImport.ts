/**
 * The import M2.2 improves against the corpus (m2-import-corpus.md, section 8): lessons from the
 * class views of the profile's grade levels, a course per Kopplung and per parallel group
 * (`CourseKey`), no rosters, A and B by ISO week parity. It reads the window a week at a time and
 * deletes only what it read completely.
 */
import { WebUntisClient } from "@schnau/webuntis-api";
import type { TimetableEntry, TimetableEntryDay } from "@schnau/webuntis-api/schemas";
import { CivilTime, CourseOffering, type Lesson, SchoolYear } from "@stu/core";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { CourseKey } from "./CourseKey.ts";
import { ImportIds } from "./ImportIds.ts";
import { Plan } from "./Plan.ts";
import { SchoolProfile } from "./profiles/SchoolProfile.ts";
import { SchoolImport } from "./SchoolImport.ts";
import { WebUntisEntry } from "./WebUntisEntry.ts";

export * as NaiveImport from "./NaiveImport.ts";

const decodeDate = Schema.decodeEffect(CivilTime.PlainDate);

/** The window's days up to `last`, as reads of at most one ISO week each. */
const weeksOf = (start: CivilTime.PlainDate, last: CivilTime.PlainDate) => {
  const weeks: Array<{
    start: string;
    end: string;
    days: ReadonlyArray<string>;
    weekdays: ReadonlyArray<string>;
    week: string;
  }> = [];

  for (let first = start; CivilTime.order(first, last) <= 0;) {
    const sunday = CivilTime.addDays(first, 7 - CivilTime.dayOfWeek(first));
    const end = CivilTime.order(sunday, last) <= 0 ? sunday : last;
    const days: Array<string> = [];
    const weekdays: Array<string> = [];

    for (let day = first; CivilTime.order(day, end) <= 0; day = CivilTime.addDays(day, 1)) {
      days.push(CivilTime.format(day));

      if (CivilTime.dayOfWeek(day) <= 5) weekdays.push(CivilTime.format(day));
    }

    weeks.push({
      start: CivilTime.format(first),
      end: CivilTime.format(end),
      days,
      weekdays,
      week: CivilTime.isoWeek(first),
    });

    first = CivilTime.addDays(end, 1);
  }

  return weeks;
};

/** The runs of consecutive `days` that `answered` holds, as ranges. */
const runsOf = (days: ReadonlyArray<string>, answered: (day: string) => boolean) => {
  const runs: Array<{ start: string; end: string }> = [];
  let open = false;

  for (const day of days) {
    const last = runs.at(-1);

    if (!answered(day)) open = false;
    else if (open && last !== undefined) last.end = day;
    else {
      runs.push({ start: day, end: day });
      open = true;
    }
  }

  return runs;
};

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

const changeKind = (entry: TimetableEntry, status: Lesson.Status) => {
  if (status === "Cancelled") return "Cancelled";

  if (WebUntisEntry.names(entry, "TEACHER").removed.length > 0) return "Substitution";

  return WebUntisEntry.names(entry, "ROOM").removed.length > 0 ? "RoomChange" : "Other";
};

const union = (lists: ReadonlyArray<ReadonlyArray<string>>) => Arr.dedupe(lists.flat()).sort();

/** An entry as the view of a class showed it, before the run knows which course it is of. */
interface Seen {
  readonly entry: TimetableEntry;
  readonly date: string;
  readonly ids: ReadonlyArray<number>;
  readonly start: number;
  readonly end: number;
  readonly subject: Option.Option<string>;
  /** The classes it is taught to, its view's own included. */
  readonly taughtTo: ReadonlyArray<string>;
  readonly family: string;
  /** Whether its family may have parallel groups, which an entry without a subject hasn't. */
  readonly grouped: boolean;
  readonly teachers: ReadonlyArray<string>;
}

/** One row of a class view, before rows of one course in one slot become one lesson. */
interface Row {
  readonly lesson: SchoolImport.ImportedLesson;
  readonly ids: ReadonlyArray<number>;
}

const byIds = Order.mapInput(Arr.makeOrder(Order.Number), (row: Row) => row.ids);

/**
 * Rows of one course at one start time as one lesson: every row's teachers and rooms, the latest
 * end, and the rows' status when they agree on it.
 */
const merge = (rows: Arr.NonEmptyReadonlyArray<Row>): SchoolImport.ImportedLesson => {
  // By their WebUntis ids, so the order of reads can't choose the first.
  const [first, ...more] = Arr.sort(rows, byIds);
  const sorted = [first, ...more];
  const lessons = sorted.map((row) => row.lesson);

  if (lessons.length === 1) return first.lesson;

  const status = lessons.every((lesson) => lesson.status === first.lesson.status)
    ? first.lesson.status
    : "Changed";

  const changes = lessons.flatMap((lesson) => (lesson.change === undefined ? [] : [lesson.change]));

  const kind =
    changes.length === lessons.length && changes.every((change) => change.kind === changes[0]?.kind)
      ? (changes[0]?.kind ?? "Other")
      : "Other";

  const text = changes.find((change) => change.text !== undefined)?.text;

  return {
    ...first.lesson,
    end: Math.max(...lessons.map((lesson) => lesson.end)),
    teacherIds: union(lessons.map((lesson) => lesson.teacherIds)),
    roomIds: union(lessons.map((lesson) => lesson.roomIds)),
    status,
    change:
      status === "Regular"
        ? undefined
        : {
            kind,
            previousTeacherIds: union(changes.map((change) => change.previousTeacherIds)),
            previousRoomIds: union(changes.map((change) => change.previousRoomIds)),
            text,
          },
  };
};

export const layer = Layer.effect(SchoolImport.Service)(
  Effect.gen(function* () {
    const client = yield* WebUntisClient;
    const failed = (reason: string) => () => new SchoolImport.ImportFailed({ reason });

    const run = Effect.fn("NaiveImport.run")(function* (input: SchoolImport.ImportInput) {
      const { profile, window, nightly } = input;
      const school = profile.id;
      const previous = Option.getOrElse(input.previous, () => SchoolImport.empty);
      const first = CivilTime.format(window.start);
      const years = yield* client.schoolyears.list.pipe(Effect.mapError(failed("school years")));
      const held = Plan.schoolYear(years, window);

      if (Option.isNone(held)) return yield* failed(`no school year holds ${first}`)();

      const { year } = held.value;
      const yearRange = { start: held.value.start, end: held.value.end };

      const yearDates = yield* Effect.all({
        start: decodeDate(yearRange.start),
        end: decodeDate(yearRange.end),
      }).pipe(Effect.mapError(failed("school year dates")));

      const calendar = SchoolYear.around(yearDates.start);
      const yearId = ImportIds.schoolYear(yearDates.start);

      // The window ends with the school year: the next one's days are its own runs' business.
      const last = CivilTime.order(window.end, yearDates.end) <= 0 ? window.end : yearDates.end;
      const weeks = weeksOf(window.start, last);

      const terms = calendar.halves.map((half) => ({
        id: ImportIds.term(yearId, half.number),
        schoolYearId: yearId,
        name: half.name,
        start: CivilTime.format(half.dates.start),
        end: CivilTime.format(half.dates.end),
      }));

      const directory = (resourceType: "CLASS" | "TEACHER" | "ROOM" | "SUBJECT") =>
        client.timetable
          .getFilter({ resourceType, ...yearRange })
          .pipe(Effect.mapError(failed(`the ${resourceType} directory`)));

      const classes = (yield* directory("CLASS")).classes.map((each) => each.class);
      const teachers = (yield* directory("TEACHER")).teachers.map((each) => each.teacher);
      const rooms = (yield* directory("ROOM")).rooms.map((each) => each.room);
      const subjects = (yield* directory("SUBJECT")).subjects.map((each) => each.subject);

      const gradeLevelOf = (name: string) =>
        SchoolProfile.gradeLevelRead(profile, profile.classify(name));

      const classIds = Plan.classes({ profile, previous, directory: classes, schoolYear: yearId });

      if (!Arr.isArrayNonEmpty(classIds))
        return yield* failed("the school has no classes to read")();

      const teacherIds = new Map(teachers.map(({ shortName, id }) => [shortName, id]));
      const roomIds = new Map(rooms.map(({ shortName, id }) => [shortName, id]));
      const subjectIds = new Map(subjects.map(({ shortName, id }) => [shortName, id]));
      const classNames = new Map(classes.map(({ id, shortName }) => [id, shortName]));
      const classIdsByName = new Map(classes.map(({ id, shortName }) => [shortName, id]));
      const teacherId = (id: number) => ImportIds.teacher(school, id);
      const roomId = (id: number) => ImportIds.room(school, id);
      const knownCourses = new Set(previous.courses.map(({ id }) => id));

      const courses = new Map<string, typeof SchoolImport.ImportedCourse.Type>();
      const courseClasses = new Map<string, Set<number>>();
      const offerings = new Map<string, SchoolImport.ImportedOffering>();
      const slots = new Map<string, Arr.NonEmptyArray<Row>>();
      const links = new Map<string, Array<SchoolImport.ProviderRef>>();
      const covers: Array<SchoolImport.Coverage> = [];
      const unattributed: Array<typeof SchoolImport.Unattributed.Type> = [];
      const diagnostics: Array<typeof SchoolImport.Diagnostic.Type> = [];

      const link = (id: string, ref: SchoolImport.ProviderRef) =>
        links.set(id, [...(links.get(id) ?? []), ref]);

      const termOf = (date: string) => terms.find((term) => term.start <= date && date <= term.end);

      /**
       * The course of `key` for an entry of a class's view, or none when only the nightly run may
       * create it, or when the entry names a subject the directory lacks, whose name could be
       * anything.
       */
      const courseOf = (
        date: string,
        subject: Option.Option<string>,
        key: string,
        taughtTo: ReadonlyArray<string>,
      ) => {
        const subjectId = Option.isSome(subject) ? subjectIds.get(subject.value) : undefined;

        if (Option.isSome(subject) && subjectId === undefined) return Option.none();

        const name = Option.getOrElse(subject, () => "?");
        const id = ImportIds.course(school, key);

        if (!nightly && !knownCourses.has(id)) return Option.none();

        courses.set(id, {
          id,
          name,
          subjectId: subjectId === undefined ? undefined : ImportIds.subject(school, subjectId),
        });

        // The classes it is taught to whose views a run reads, so which of their views answered
        // can't change where it is read from or who it is offered to.
        const read = taughtTo.flatMap((group) => {
          const classId = classIdsByName.get(group);
          const gradeLevel = gradeLevelOf(group);

          return classId === undefined || Option.isNone(gradeLevel)
            ? []
            : [{ group, classId, gradeLevel: gradeLevel.value }];
        });

        courseClasses.set(
          id,
          new Set([...(courseClasses.get(id) ?? []), ...read.map((each) => each.classId)]),
        );

        const term = termOf(date);

        if (nightly && term !== undefined) {
          const offeringId = CourseOffering.idFor(id, term.id);

          // An offering can't name classes for one grade only, so a course of a class and a whole
          // grade is offered to every class of both grades.
          for (const { group, gradeLevel } of read) {
            const lasting = profile.classify(group)._tag === "Lasting";

            offerings.set(
              offeringId,
              SchoolImport.widen(offerings.get(offeringId), {
                id: offeringId,
                courseId: id,
                termId: term.id,
                gradeLevels: [gradeLevel],
                classIds: lasting ? [ImportIds.schoolClass(yearId, group)] : [],
              }),
            );
          }
        }

        return Option.some(id);
      };

      const unattributedEntry = (date: string, ids: ReadonlyArray<number>) => {
        unattributed.push({ date, ids });
        diagnostics.push({ code: "unattributed", detail: `${date} ${ids.join("+")}` });
      };

      const seen: Array<Seen> = [];

      // A Kopplung's entry is in the view of each of its classes, and one lesson of its course.
      const copies = new Set<string>();

      /**
       * Keeps the entry of `group`'s view until every week is read, since which course it is of
       * depends on the others, or says the read can't count as complete.
       */
      const observe = (
        day: TimetableEntryDay,
        group: string | undefined,
        entry: TimetableEntry,
      ): boolean => {
        const date = day.date.slice(0, 10);
        const ids = WebUntisEntry.ids(entry);
        const start = WebUntisEntry.timeOfDay(entry.duration.start);
        const end = WebUntisEntry.timeOfDay(entry.duration.end);

        if (Option.isNone(start) || Option.isNone(end)) {
          diagnostics.push({ code: "unreadable-time", detail: `${date} ${ids.join("+")}` });

          return false;
        }

        if (group === undefined) unattributedEntry(date, ids);
        else {
          const subject = Option.fromUndefinedOr(WebUntisEntry.names(entry, "SUBJECT").current[0]);
          const ofFamily = CourseKey.familyOf(subject, entry, group);
          const copy = `${ofFamily.family}\n${date}\n${ids.join("+")}`;

          if (!copies.has(copy)) {
            copies.add(copy);

            seen.push({
              entry,
              date,
              ids,
              start: start.value,
              end: end.value,
              subject,
              ...ofFamily,
              teachers: WebUntisEntry.names(entry, "TEACHER").planned,
            });
          }
        }

        return true;
      };

      /** Adds the row of an entry `seen` holds to the lesson of its course in its slot. */
      const addRow = (
        { entry, date, ids, start, end, subject, taughtTo, family, grouped, teachers }: Seen,
        courseKey: (family: string, teachers: ReadonlyArray<string>) => string,
      ) => {
        const key = grouped ? courseKey(family, teachers) : family;
        const course = courseOf(date, subject, key, taughtTo);

        if (Option.isNone(course)) return unattributedEntry(date, ids);

        const id = ImportIds.lesson(school, course.value, date, start);
        const teacherNames = WebUntisEntry.names(entry, "TEACHER");
        const roomNames = WebUntisEntry.names(entry, "ROOM");
        const status = WebUntisEntry.status(entry);
        const text = entry.substitutionText ?? undefined;

        const row: Row = {
          ids,
          lesson: {
            id,
            courseId: course.value,
            date,
            start,
            end,
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
                    text,
                  },
          },
        };

        const slot = slots.get(id);

        if (slot === undefined) slots.set(id, [row]);
        else slot.push(row);

        link(id, SchoolImport.ProviderRef.cases.Entry.make({ date, ids }));
      };

      for (const week of weeks) {
        const range = { start: week.start, end: week.end };

        const results = yield* client.timetable
          .getEntriesForResources({ resourceType: "CLASS", resources: classIds, ...range })
          .pipe(Effect.mapError(failed("class timetables")));

        // A read is complete when WebUntis answered with no error, showed every weekday of the
        // range for the class asked for, under the name the directory gives it, and every entry
        // was read. Only then may its days replace stored lessons. A class the directory no longer
        // lists has no name to attribute its entries by.
        const unread: Array<number> = [];
        const answered: Array<ReadonlySet<string>> = [];

        for (const { resource, result } of results) {
          const days = Result.isSuccess(result) ? result.success.days : [];
          const group = classNames.get(resource);

          const named = days.filter(
            (day) =>
              day.resourceType === "CLASS" &&
              day.resource.id === resource &&
              (group === undefined || day.resource.shortName === group) &&
              week.start <= day.date.slice(0, 10) &&
              day.date.slice(0, 10) <= week.end,
          );

          const added = named.flatMap((day) =>
            day.gridEntries.map((entry) => observe(day, group, entry)),
          );

          answered.push(new Set(named.map((day) => day.date.slice(0, 10))));

          // Even an empty day of such a class may hide a lesson we can't name, so none of its
          // days deletes one.
          if (group === undefined) {
            unattributed.push(...named.map((day) => ({ date: day.date.slice(0, 10), ids: [] })));
          }

          if (
            Result.isFailure(result) ||
            result.success.errors.length > 0 ||
            named.length !== days.length ||
            !days.every(WebUntisEntry.shown) ||
            !week.weekdays.every((day) => named.some((each) => each.date.startsWith(day))) ||
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

        // Only the days every class answered, so a weekend no view showed deletes nothing.
        if (unread.length === 0) {
          covers.push(
            ...runsOf(week.days, (day) => answered.every((each) => each.has(day))).map((run) => ({
              rows: "lessons" as const,
              ...run,
            })),
          );
        }
      }

      // Which families meet in parallel groups shows only across the whole window. Only the nightly
      // run, which alone creates courses, splits a family; a daytime run keeps the courses it knows.
      const courseKey = CourseKey.resolver(
        CourseKey.parallel(
          seen.flatMap(({ family, grouped, date, start, teachers, entry }) =>
            nightly && grouped
              ? [
                  {
                    family,
                    date,
                    start,
                    teachers,
                    regular: WebUntisEntry.status(entry) === "Regular",
                  },
                ]
              : [],
          ),
        ),
        (key) => knownCourses.has(ImportIds.course(school, key)),
      );

      for (const each of seen) addRow(each, courseKey);

      const lessons = [...slots.values()].map(merge);

      const holidays = yield* Effect.option(client.app.getData);

      const closures = Option.match(holidays, {
        onNone: () => {
          diagnostics.push({ code: "read-failed", detail: "app data" });

          return [];
        },
        onSome: (data) => {
          // The holidays answer for WebUntis's current school year, which in the summer may not
          // be the one the window is in.
          if (data.currentSchoolYear?.id === year.id) {
            covers.push({ rows: "closures", ...yearRange });
          }

          return data.holidays.map((holiday) => {
            const id = ImportIds.closure(school, holiday.id);

            link(id, SchoolImport.ProviderRef.cases.Holiday.make({ id: holiday.id }));

            return {
              id,
              name: holiday.name,
              start: holiday.start.slice(0, 10),
              end: holiday.end.slice(0, 10),
            };
          });
        },
      });

      const examList = yield* Effect.option(
        client.exams.list({ start: first, end: CivilTime.format(last) }),
      );

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

            link(id, SchoolImport.ProviderRef.cases.Exam.make({ id: exam.examId }));

            // An exam lists every class of its course, and the teachers of its group.
            const classNamesOfExam = exam.classes.map(({ shortName }) => shortName);

            const key = courseKey(
              CourseKey.family(
                exam.subject.shortName,
                classNamesOfExam.length === 0 ? ["?"] : classNamesOfExam,
              ),
              exam.teachers.map(({ shortName }) => shortName),
            );

            return [
              {
                id,
                courseId: ImportIds.course(school, key),
                date: exam.examStart.slice(0, 10),
                start: start.value,
                end: end.value,
              },
            ];
          });

          // An exam whose time didn't read would otherwise be deleted with nothing in its place.
          if (read.length === list.exams.length) {
            covers.push({ rows: "exams", start: first, end: CivilTime.format(last) });
          }

          return read;
        },
      });

      const lastingClasses = classes.flatMap(({ id, shortName }) => {
        const classification = profile.classify(shortName);

        return classification._tag === "Lasting" && Option.isSome(gradeLevelOf(shortName))
          ? [{ webUntisId: id, shortName, gradeLevel: classification.gradeLevel }]
          : [];
      });

      const resource = (type: "CLASS" | "TEACHER" | "ROOM" | "SUBJECT", id: number) =>
        SchoolImport.ProviderRef.cases.Resource.make({ type, id });

      return {
        schoolYears: [
          {
            id: yearId,
            name: year.name,
            start: yearRange.start,
            end: yearRange.end,
          },
        ],
        terms,
        subjects: subjects.map(({ id, shortName, longName }) => ({
          id: ImportIds.subject(school, id),
          name: longName,
          shortName,
        })),
        classes: lastingClasses.map(({ shortName, gradeLevel }) => ({
          id: ImportIds.schoolClass(yearId, shortName),
          schoolYearId: yearId,
          name: shortName,
          gradeLevel,
        })),
        courses: [...courses.values()],
        offerings: [...offerings.values()],
        lessons,
        closures,
        exams,
        teachers: teachers.map(({ id, shortName, longName }) => {
          const teacher = { id: teacherId(id), shortName };
          const displayName = longName.trim();

          // A long name that repeats the short one says nothing more.
          return displayName === "" || displayName === shortName
            ? teacher
            : { ...teacher, displayName };
        }),
        rooms: rooms.map(({ id, shortName }) => ({ id: roomId(id), name: shortName })),
        weeks: weeks.map(({ week }) => ({
          week,
          label: Number(week.slice(-2)) % 2 === 1 ? "A" : "B",
        })),
        links: [
          ...[...links].map(([id, refs]) => ({ id, refs })),
          ...[...courseClasses].map(([id, ids]) => ({
            id,
            refs: [...ids].sort((a, b) => a - b).map((each) => resource("CLASS", each)),
          })),
          ...lastingClasses.map(({ webUntisId, shortName }) => ({
            id: ImportIds.schoolClass(yearId, shortName),
            refs: [resource("CLASS", webUntisId)],
          })),
          ...subjects.map(({ id }) => ({
            id: ImportIds.subject(school, id),
            refs: [resource("SUBJECT", id)],
          })),
          ...teachers.map(({ id }) => ({ id: teacherId(id), refs: [resource("TEACHER", id)] })),
          ...rooms.map(({ id }) => ({ id: roomId(id), refs: [resource("ROOM", id)] })),
        ],
        covers,
        unattributed,
        diagnostics,
      } satisfies SchoolImport.ImportResult;
    });

    return SchoolImport.Service.of({ run });
  }),
);
