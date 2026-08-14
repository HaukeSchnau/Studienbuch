import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  AcademicTermId,
  BellPeriodId,
  CalendarDate,
  CourseOfferingId,
  DateInterval,
  LocalTime,
  NonEmptyText,
  PersonId,
  RecurringMeetingId,
  ScheduleExceptionId,
  SchoolId,
  TimeRange,
} from "../../src/primitives";
import {
  AcademicCalendar,
  AcademicTerm,
  BellPeriod,
  CalendarClosure,
  LessonOccurrenceRef,
  RecurringMeeting,
  RotationPattern,
  ScheduleException,
  findBellPeriodCollisions,
  findRecurringMeetingCollisions,
  isSchoolDay,
  materializeSchoolDay,
  meetingOccursOn,
  nextSchoolDay,
} from "../../src/schedule";

const date = (value: string) => CalendarDate.make(value);
const time = (value: number) => LocalTime.make(value);
const range = (start: number, end: number) =>
  TimeRange.make({ start: time(start), end: time(end) });
const interval = (start: string, end: string) =>
  DateInterval.make({ start: date(start), end: date(end) });

const schoolId = SchoolId.make("school-1");
const term = AcademicTerm.make({
  id: AcademicTermId.make("term-1"),
  schoolId,
  name: NonEmptyText.make("First term"),
  interval: interval("2022-12-01", "2023-02-28"),
});

const calendar = AcademicCalendar.make({
  schoolId,
  schoolDays: [1, 2, 3, 4, 5],
  terms: [term],
  closures: [
    CalendarClosure.make({
      name: NonEmptyText.make("Winter break"),
      interval: interval("2022-12-23", "2023-01-06"),
    }),
  ],
});

const everyWeek = RotationPattern.cases.EveryWeek.make({});

const meeting = (
  id: string,
  overrides: Partial<Parameters<typeof RecurringMeeting.make>[0]> = {},
) =>
  RecurringMeeting.make({
    id: RecurringMeetingId.make(id),
    courseOfferingId: CourseOfferingId.make(`course-${id}`),
    weekday: 1,
    timeRange: range(8 * 60, 8 * 60 + 45),
    rotation: everyWeek,
    effectiveInterval: term.interval,
    room: NonEmptyText.make("A1"),
    teacherIds: [PersonId.make(`teacher-${id}`)],
    ...overrides,
  });

describe("academic calendar", () => {
  it("treats both closure boundaries as closed and finds the next school day", () => {
    assert.isFalse(isSchoolDay(calendar, date("2022-12-23")));
    assert.isFalse(isSchoolDay(calendar, date("2023-01-06")));
    assert.deepEqual(
      Option.getOrUndefined(nextSchoolDay(calendar, date("2023-01-05"))),
      date("2023-01-09"),
    );
  });

  it.effect("suppresses recurring meetings during closures", () =>
    Effect.gen(function* () {
      const result = yield* materializeSchoolDay({
        calendar,
        date: date("2022-12-26"),
        meetings: [meeting("math")],
        exceptions: [],
      });
      assert.deepEqual(result, []);
    }),
  );

  it.effect("rejects foreign-school and overlapping calendar terms", () =>
    Effect.gen(function* () {
      const malformed = {
        schoolId,
        schoolDays: calendar.schoolDays,
        terms: [
          term,
          AcademicTerm.make({
            ...term,
            id: AcademicTermId.make("foreign"),
            schoolId: SchoolId.make("other-school"),
          }),
        ],
        closures: [],
      };
      yield* Schema.decodeEffect(AcademicCalendar)(malformed).pipe(Effect.flip);
    }),
  );
});

describe("half-open schedule ranges", () => {
  it("allows adjacent bell periods and finds actual overlaps", () => {
    const first = BellPeriod.make({
      id: BellPeriodId.make("period-1"),
      label: NonEmptyText.make("1"),
      timeRange: range(8 * 60, 8 * 60 + 45),
    });
    const adjacent = BellPeriod.make({
      id: BellPeriodId.make("period-2"),
      label: NonEmptyText.make("2"),
      timeRange: range(8 * 60 + 45, 9 * 60 + 30),
    });
    const overlapping = BellPeriod.make({
      id: BellPeriodId.make("period-3"),
      label: NonEmptyText.make("Overlap"),
      timeRange: range(8 * 60 + 30, 9 * 60),
    });

    assert.deepEqual(findBellPeriodCollisions([adjacent, first]), []);
    assert.deepEqual(findBellPeriodCollisions([overlapping, adjacent, first]), [
      { leftId: first.id, rightId: overlapping.id },
      { leftId: adjacent.id, rightId: overlapping.id },
    ]);
  });

  it("does not report odd and even rotations as colliding", () => {
    const odd = meeting("odd", {
      rotation: RotationPattern.cases.OddIsoWeek.make({}),
    });
    const even = meeting("even", {
      rotation: RotationPattern.cases.EvenIsoWeek.make({}),
    });
    assert.deepEqual(findRecurringMeetingCollisions([odd, even]), []);
    assert.equal(findRecurringMeetingCollisions([odd, meeting("weekly")]).length, 1);
  });
});

describe("ISO week rotation", () => {
  it("uses the ISO week across the calendar-year boundary", () => {
    const evenSunday = meeting("rotation", {
      weekday: 7,
      rotation: RotationPattern.cases.EvenIsoWeek.make({}),
    });
    // 2023-01-01 belongs to ISO week 52 of 2022.
    assert.isTrue(meetingOccursOn(evenSunday, date("2023-01-01")));
  });
});

describe("lesson occurrence materialization", () => {
  const monday = date("2023-01-09");
  const tuesday = date("2023-01-10");
  const baseMeeting = meeting("math");
  const target = LessonOccurrenceRef.make({ meetingId: baseMeeting.id, scheduledDate: monday });

  it.effect("cancels a dated occurrence", () =>
    Effect.gen(function* () {
      const result = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          ScheduleException.cases.Cancelled.make({
            id: ScheduleExceptionId.make("cancel"),
            target,
          }),
        ],
      });
      assert.deepEqual(result, []);
    }),
  );

  it.effect("moves an occurrence to another date while preserving its identity", () =>
    Effect.gen(function* () {
      const rescheduled = ScheduleException.cases.Rescheduled.make({
        id: ScheduleExceptionId.make("reschedule"),
        target,
        date: tuesday,
        timeRange: range(10 * 60, 10 * 60 + 45),
      });
      const originalDay = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [rescheduled],
      });
      const destinationDay = yield* materializeSchoolDay({
        calendar,
        date: tuesday,
        meetings: [baseMeeting],
        exceptions: [rescheduled],
      });

      assert.deepEqual(originalDay, []);
      assert.equal(destinationDay.length, 1);
      const occurrence = destinationDay[0];
      if (occurrence === undefined) return yield* Effect.die("Expected the rescheduled occurrence");
      assert.equal(occurrence.scheduledDate, monday);
      assert.equal(occurrence.date, tuesday);
      assert.equal(occurrence.id, `${baseMeeting.id}@${monday}`);
    }),
  );

  it.effect("does not resurrect a closure-suppressed occurrence by rescheduling it", () =>
    Effect.gen(function* () {
      const holidayTarget = LessonOccurrenceRef.make({
        meetingId: baseMeeting.id,
        scheduledDate: date("2022-12-26"),
      });
      const failure = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          ScheduleException.cases.Rescheduled.make({
            id: ScheduleExceptionId.make("holiday-reschedule"),
            target: holidayTarget,
            date: monday,
            timeRange: range(10 * 60, 10 * 60 + 45),
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
      const result = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          ScheduleException.cases.Cancelled.make({
            id: ScheduleExceptionId.make("unrelated-stale"),
            target: LessonOccurrenceRef.make({
              meetingId: RecurringMeetingId.make("missing"),
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
      const firstExceptionId = ScheduleExceptionId.make("room-a");
      const secondExceptionId = ScheduleExceptionId.make("room-z");
      const failure = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          ScheduleException.cases.RoomChanged.make({
            id: secondExceptionId,
            target,
            room: NonEmptyText.make("B2"),
          }),
          ScheduleException.cases.RoomChanged.make({
            id: firstExceptionId,
            target,
            room: NonEmptyText.make("C3"),
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
      const missingTarget = LessonOccurrenceRef.make({
        meetingId: RecurringMeetingId.make("missing"),
        scheduledDate: monday,
      });
      const failure = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [baseMeeting],
        exceptions: [
          ScheduleException.cases.Cancelled.make({
            id: ScheduleExceptionId.make("unresolved"),
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
      const later = meeting("later", { timeRange: range(11 * 60, 11 * 60 + 45) });
      const earlier = meeting("earlier", { timeRange: range(9 * 60, 9 * 60 + 45) });
      const first = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [later, earlier],
        exceptions: [],
      });
      const second = yield* materializeSchoolDay({
        calendar,
        date: monday,
        meetings: [earlier, later],
        exceptions: [],
      });
      assert.deepEqual(first, second);
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
      const failure = yield* materializeSchoolDay({
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
