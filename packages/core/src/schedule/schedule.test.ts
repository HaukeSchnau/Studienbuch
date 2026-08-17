import { assert, describe, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { AcademicTermId, CourseOfferingId, PersonId, SchoolId } from "../organization/identity";
import { Organization } from "../index.ts";
import { Schedule } from "../index.ts";

const date = (value: string) => PlainDate.fromString(value, Calendar.getBasic);
const time = (hour: number, minute: number, second = 0, millisecond = 0) =>
  Schedule.LocalTime.Schema.make(hour * 3_600_000 + minute * 60_000 + second * 1_000 + millisecond);
const range = (start: Schedule.LocalTime.Type, end: Schedule.LocalTime.Type) =>
  Schedule.LocalTimeRange.Schema.make({ start, end });
const interval = (start: string, end: string) =>
  CalendarDateRange.Schema.make({ start: date(start), end: date(end) });

const schoolId = SchoolId.make("school-1");
const term = Organization.AcademicTerm.make({
  id: AcademicTermId.make("term-1"),
  schoolId,
  name: "First term",
  interval: interval("2022-12-01", "2023-02-28"),
});

const calendar = Schedule.AcademicCalendar.make({
  schoolId,
  schoolDays: [1, 2, 3, 4, 5],
  terms: [term],
  closures: [
    Schedule.CalendarClosure.make({
      name: "Winter break",
      interval: interval("2022-12-23", "2023-01-06"),
    }),
  ],
});

const everyWeek = Schedule.RotationPattern.cases.EveryWeek.make({});

const meeting = (
  id: string,
  overrides: Partial<Parameters<typeof Schedule.RecurringMeeting.make>[0]> = {},
) =>
  Schedule.RecurringMeeting.make({
    id: Schedule.RecurringMeetingId.make(id),
    courseOfferingId: CourseOfferingId.make(`course-${id}`),
    weekday: 1,
    timeRange: range(time(8, 0), time(8, 45)),
    rotation: everyWeek,
    effectiveInterval: term.interval,
    room: "A1",
    teacherIds: [PersonId.make(`teacher-${id}`)],
    ...overrides,
  });

describe("local schedule time", () => {
  it("exposes millisecond precision through its numeric wire value", () => {
    const minutePrecision = time(8, 5);
    const secondPrecision = time(8, 5, 9);
    const millisecondPrecision = time(8, 5, 9, 7);

    assert.equal(Schedule.LocalTime.toString(minutePrecision), "08:05:00.000");
    assert.equal(Schedule.LocalTime.second(secondPrecision), 9);
    assert.equal(Schedule.LocalTime.millisecond(millisecondPrecision), 7);
    assert.equal(Schedule.LocalTime.hour(millisecondPrecision), 8);
    assert.equal(Schedule.LocalTime.minute(millisecondPrecision), 5);
  });

  it.effect("covers the millisecond boundaries and round-trips its numeric wire value", () =>
    Effect.gen(function* () {
      const first = Schedule.LocalTime.Schema.make(0);
      const last = Schedule.LocalTime.Schema.make(86_399_999);
      assert.equal(Schedule.LocalTime.toString(first), "00:00:00.000");
      assert.equal(Schedule.LocalTime.toString(last), "23:59:59.999");
      assert.isFalse(Schema.is(Schedule.LocalTime.Schema)(-1));
      assert.isFalse(Schema.is(Schedule.LocalTime.Schema)(86_400_000));

      const decoded = yield* Schema.decodeEffect(Schedule.LocalTime.Schema)(29_109_007);
      assert.equal(yield* Schema.encodeEffect(Schedule.LocalTime.Schema)(decoded), 29_109_007);
      assert.isTrue(Schedule.LocalTime.Equivalence(decoded, time(8, 5, 9, 7)));
    }),
  );

  it("models ranges as non-empty and half-open", () => {
    const start = time(9, 0);
    const end = time(9, 0, 0, 1);
    const value = range(start, end);
    assert.isTrue(Schedule.LocalTimeRange.contains(value, start));
    assert.isFalse(Schedule.LocalTimeRange.contains(value, end));
    assert.equal(Duration.toMillis(Schedule.LocalTimeRange.duration(value)), 1);
    assert.isFalse(Schema.is(Schedule.LocalTimeRange.Schema)({ start: end, end: start }));
    assert.isFalse(Schema.is(Schedule.LocalTimeRange.Schema)({ start, end: start }));
  });
});

describe("academic calendar", () => {
  it("treats both closure boundaries as closed and finds the next school day", () => {
    assert.isFalse(Schedule.isSchoolDay(calendar, date("2022-12-23")));
    assert.isFalse(Schedule.isSchoolDay(calendar, date("2023-01-06")));
    const next = Option.getOrThrow(Schedule.nextSchoolDay(calendar, date("2023-01-05")));
    assert.isTrue(PlainDate.equals(next, date("2023-01-09")));
  });

  it.effect("suppresses recurring meetings during closures", () =>
    Effect.gen(function* () {
      const result = yield* Schedule.materializeSchoolDay({
        calendar,
        date: date("2022-12-26"),
        meetings: [meeting("math")],
        exceptions: [],
      });
      assert.deepEqual(result, []);
    }),
  );

  it("rejects foreign-school and overlapping calendar terms", () => {
    const malformed = {
      schoolId,
      schoolDays: calendar.schoolDays,
      terms: [
        term,
        Organization.AcademicTerm.make({
          ...term,
          id: AcademicTermId.make("foreign"),
          schoolId: SchoolId.make("other-school"),
        }),
      ],
      closures: [],
    };
    assert.isTrue(Option.isNone(Schedule.AcademicCalendar.makeOption(malformed)));
  });
});

describe("half-open schedule ranges", () => {
  it("allows adjacent bell periods and finds actual overlaps", () => {
    const first = Schedule.BellPeriod.make({
      id: Schedule.BellPeriodId.make("period-1"),
      label: "1",
      timeRange: range(time(8, 0), time(8, 45)),
    });
    const adjacent = Schedule.BellPeriod.make({
      id: Schedule.BellPeriodId.make("period-2"),
      label: "2",
      timeRange: range(time(8, 45), time(9, 30)),
    });
    const overlapping = Schedule.BellPeriod.make({
      id: Schedule.BellPeriodId.make("period-3"),
      label: "Overlap",
      timeRange: range(time(8, 30), time(9, 0)),
    });

    assert.deepEqual(Schedule.findBellPeriodCollisions([adjacent, first]), []);
    assert.deepEqual(Schedule.findBellPeriodCollisions([overlapping, adjacent, first]), [
      { leftId: first.id, rightId: overlapping.id },
      { leftId: adjacent.id, rightId: overlapping.id },
    ]);
  });

  it("does not report odd and even rotations as colliding", () => {
    const odd = meeting("odd", {
      rotation: Schedule.RotationPattern.cases.OddIsoWeek.make({}),
    });
    const even = meeting("even", {
      rotation: Schedule.RotationPattern.cases.EvenIsoWeek.make({}),
    });
    assert.deepEqual(Schedule.findRecurringMeetingCollisions([odd, even]), []);
    assert.equal(Schedule.findRecurringMeetingCollisions([odd, meeting("weekly")]).length, 1);
  });

  it("recognizes separately decoded equal occurrence dates", () => {
    const firstDate = date("2023-01-09");
    const secondDate = date("2023-01-09");
    const first = Schedule.LessonOccurrence.make({
      id: Schedule.LessonOccurrenceId.make("occurrence-a"),
      meetingId: Schedule.RecurringMeetingId.make("meeting-a"),
      courseOfferingId: CourseOfferingId.make("course-a"),
      scheduledDate: firstDate,
      date: firstDate,
      timeRange: range(time(8, 0), time(8, 45)),
      teacherIds: [],
      appliedExceptionIds: [],
    });
    const second = Schedule.LessonOccurrence.make({
      id: Schedule.LessonOccurrenceId.make("occurrence-b"),
      meetingId: Schedule.RecurringMeetingId.make("meeting-b"),
      courseOfferingId: CourseOfferingId.make("course-b"),
      scheduledDate: secondDate,
      date: secondDate,
      timeRange: range(time(8, 30), time(9, 0)),
      teacherIds: [],
      appliedExceptionIds: [],
    });

    assert.deepEqual(Schedule.findLessonOccurrenceCollisions([first, second]), [
      { leftId: first.id, rightId: second.id },
    ]);
  });
});

describe("ISO week rotation", () => {
  it("uses the ISO week across the calendar-year boundary", () => {
    const evenSunday = meeting("rotation", {
      weekday: 7,
      rotation: Schedule.RotationPattern.cases.EvenIsoWeek.make({}),
    });
    // 2023-01-01 belongs to ISO week 52 of 2022.
    assert.isTrue(Schedule.meetingOccursOn(evenSunday, date("2023-01-01")));
  });

  it("uses the ISO week-numbering year at a calendar-year boundary", () => {
    const oddFriday = meeting("week-year", {
      weekday: 5,
      rotation: Schedule.RotationPattern.cases.OddIsoWeek.make({}),
      effectiveInterval: interval("2020-12-28", "2021-01-03"),
    });
    // 2021-01-01 is Friday of ISO week 53 in ISO week-numbering year 2020.
    assert.isTrue(Schedule.meetingOccursOn(oddFriday, date("2021-01-01")));
  });
});

describe("lesson occurrence materialization", () => {
  const monday = date("2023-01-09");
  const tuesday = date("2023-01-10");
  const wednesday = date("2023-01-11");
  const baseMeeting = meeting("math");
  const target = Schedule.LessonOccurrenceRef.make({
    meetingId: baseMeeting.id,
    scheduledDate: monday,
  });

  it.effect("cancels a dated occurrence", () =>
    Effect.gen(function* () {
      const result = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          Schedule.ScheduleException.cases.Cancelled.make({
            id: Schedule.ScheduleExceptionId.make("cancel"),
            target,
          }),
        ],
      });
      assert.deepEqual(result, []);
    }),
  );

  it.effect("moves an occurrence to another date while preserving its identity", () =>
    Effect.gen(function* () {
      const rescheduled = Schedule.ScheduleException.cases.Rescheduled.make({
        id: Schedule.ScheduleExceptionId.make("reschedule"),
        target,
        date: tuesday,
        timeRange: range(time(10, 0), time(10, 45)),
      });
      const originalDay = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [rescheduled],
      });
      const destinationDay = yield* Schedule.materializeSchoolDay({
        calendar,
        date: tuesday,
        meetings: [baseMeeting],
        exceptions: [rescheduled],
      });

      assert.deepEqual(originalDay, []);
      assert.equal(destinationDay.length, 1);
      const occurrence = destinationDay[0];
      if (occurrence === undefined) return yield* Effect.die("Expected the rescheduled occurrence");
      assert.isTrue(PlainDate.equals(occurrence.scheduledDate, monday));
      assert.isTrue(PlainDate.equals(occurrence.date, tuesday));
      assert.equal(occurrence.id, `${baseMeeting.id}@${PlainDate.toString(monday)}`);
    }),
  );

  it.effect("does not resurrect a closure-suppressed occurrence by rescheduling it", () =>
    Effect.gen(function* () {
      const holidayTarget = Schedule.LessonOccurrenceRef.make({
        meetingId: baseMeeting.id,
        scheduledDate: date("2022-12-26"),
      });
      const failure = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          Schedule.ScheduleException.cases.Rescheduled.make({
            id: Schedule.ScheduleExceptionId.make("holiday-reschedule"),
            target: holidayTarget,
            date: monday,
            timeRange: range(time(10, 0), time(10, 45)),
          }),
        ],
      }).pipe(Effect.flip);
      assert.equal(failure._tag, "Schedule.UnresolvedException");
      if (failure._tag === "Schedule.UnresolvedException") {
        assert.equal(failure.reason, "OccurrenceNotScheduled");
      }
    }),
  );

  it.effect("ignores unrelated invalid exceptions when materializing a day", () =>
    Effect.gen(function* () {
      const result = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          Schedule.ScheduleException.cases.Cancelled.make({
            id: Schedule.ScheduleExceptionId.make("unrelated-stale"),
            target: Schedule.LessonOccurrenceRef.make({
              meetingId: Schedule.RecurringMeetingId.make("missing"),
              scheduledDate: tuesday,
            }),
          }),
        ],
      });
      assert.equal(result.length, 1);
    }),
  );

  it.effect("fails conflicting exception operations deterministically", () =>
    Effect.gen(function* () {
      const firstExceptionId = Schedule.ScheduleExceptionId.make("room-a");
      const secondExceptionId = Schedule.ScheduleExceptionId.make("room-z");
      const failure = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          Schedule.ScheduleException.cases.RoomChanged.make({
            id: secondExceptionId,
            target,
            room: "B2",
          }),
          Schedule.ScheduleException.cases.RoomChanged.make({
            id: firstExceptionId,
            target,
            room: "C3",
          }),
        ],
      }).pipe(Effect.flip);

      assert.equal(failure._tag, "Schedule.ConflictingExceptions");
      if (failure._tag === "Schedule.ConflictingExceptions") {
        assert.deepEqual(failure.exceptionIds, [firstExceptionId, secondExceptionId]);
      }
    }),
  );

  it.effect("detects conflicting reschedules before selecting one destination day", () =>
    Effect.gen(function* () {
      const firstExceptionId = Schedule.ScheduleExceptionId.make("reschedule-tuesday");
      const secondExceptionId = Schedule.ScheduleExceptionId.make("reschedule-wednesday");
      const failure = yield* Schedule.materializeSchoolDay({
        calendar,
        date: tuesday,
        meetings: [baseMeeting],
        exceptions: [
          Schedule.ScheduleException.cases.Rescheduled.make({
            id: secondExceptionId,
            target,
            date: wednesday,
            timeRange: range(time(10, 0), time(10, 45)),
          }),
          Schedule.ScheduleException.cases.Rescheduled.make({
            id: firstExceptionId,
            target,
            date: tuesday,
            timeRange: range(time(10, 0), time(10, 45)),
          }),
        ],
      }).pipe(Effect.flip);

      assert.equal(failure._tag, "Schedule.ConflictingExceptions");
      if (failure._tag === "Schedule.ConflictingExceptions") {
        assert.deepEqual(failure.exceptionIds, [firstExceptionId, secondExceptionId]);
      }
    }),
  );

  it.effect("reports an exception whose target cannot be resolved", () =>
    Effect.gen(function* () {
      const missingTarget = Schedule.LessonOccurrenceRef.make({
        meetingId: Schedule.RecurringMeetingId.make("missing"),
        scheduledDate: monday,
      });
      const failure = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          Schedule.ScheduleException.cases.Cancelled.make({
            id: Schedule.ScheduleExceptionId.make("unresolved"),
            target: missingTarget,
          }),
        ],
      }).pipe(Effect.flip);

      assert.equal(failure._tag, "Schedule.UnresolvedException");
      if (failure._tag === "Schedule.UnresolvedException") {
        assert.equal(failure.reason, "MeetingNotFound");
      }
    }),
  );

  it.effect("orders results independently of input order", () =>
    Effect.gen(function* () {
      const later = meeting("later", { timeRange: range(time(11, 0), time(11, 45)) });
      const earlier = meeting("earlier", { timeRange: range(time(9, 0), time(9, 45)) });
      const first = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [later, earlier],
        exceptions: [],
      });
      const second = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [earlier, later],
        exceptions: [],
      });
      const encodeOccurrences = Schema.encodeEffect(Schema.Array(Schedule.LessonOccurrence));
      const encodedFirst = yield* encodeOccurrences(first);
      const encodedSecond = yield* encodeOccurrences(second);
      assert.deepEqual(encodedFirst, encodedSecond);
      assert.deepEqual(
        first.map((occurrence) => occurrence.meetingId),
        [earlier.id, later.id],
      );
    }),
  );

  it.effect("rejects duplicate meeting identities instead of depending on input order", () =>
    Effect.gen(function* () {
      const duplicate = meeting("math", {
        courseOfferingId: CourseOfferingId.make("different-course"),
      });
      const failure = yield* Schedule.materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting, duplicate],
        exceptions: [],
      }).pipe(Effect.flip);
      assert.deepInclude(failure, {
        _tag: "Schedule.InvalidInput",
        reason: "DuplicateMeetingId",
        id: baseMeeting.id,
      });
    }),
  );
});
