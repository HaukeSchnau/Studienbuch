import { Assessment, Attendance, Importing, Organization, Schedule, Tasks } from "@stu/core";
import { AggregateRevision } from "@stu/core/foundation/aggregate-revision";
import { Artifact } from "@stu/core/foundation/artifact";
import { CalendarDateRange } from "@stu/core/foundation/calendar-date-range";
import type { NonBlankText } from "@stu/core/foundation/non-blank-text";
import { PlainDateSchema } from "@stu/core/foundation/plain-date";
import { LocalTime } from "@stu/core/schedule/local-time";
import { LocalTimeRange } from "@stu/core/schedule/local-time-range";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { describe, expect, it } from "vite-plus/test";

/**
 * These imports are the test. Every subpath in `package.json` is entered here, so a missing or
 * misspelled export map entry fails to resolve rather than failing silently in an app months later.
 *
 * Deliberately absent: assertions that a re-export is reference-equal to its source. That is
 * guaranteed by ES modules, not by anything this package does.
 */
describe("public API", () => {
  it("reaches every domain namespace from the package root", () => {
    expect(Assessment.GradeValue).toBeDefined();
    expect(Attendance.acknowledge).toBeTypeOf("function");
    expect(Importing.reconcileIncoming).toBeTypeOf("function");
    expect(Organization.authorize).toBeTypeOf("function");
    expect(Schedule.materializeSchoolDay).toBeTypeOf("function");
    expect(Tasks.complete).toBeTypeOf("function");
  });

  it("lets a bundle-sensitive client reach a foundation value without the root barrel", () => {
    const date: PlainDate.Record = PlainDate.fromString("2026-08-16", Calendar.getBasic);
    const dateRange: CalendarDateRange.Type = CalendarDateRange.Schema.make({
      start: date,
      end: date,
    });
    const start: LocalTime.Type = LocalTime.Schema.make(28_800_000);
    const timeRange: LocalTimeRange.Type = LocalTimeRange.Schema.make({
      start,
      end: LocalTime.Schema.make(31_500_000),
    });

    expect(AggregateRevision.initial).toBe(0);
    expect(PlainDateSchema).toBeDefined();
    expect(CalendarDateRange.contains(dateRange, date)).toBe(true);
    expect(LocalTimeRange.contains(timeRange, start)).toBe(true);
    expect(
      Artifact.Reference.make({
        id: Artifact.Id.make("artifact-1"),
        mediaType: Artifact.MediaType.make("application/pdf"),
      }).id,
    ).toBe("artifact-1");
  });

  it("accepts a non-blank literal as domain text without a construction call", () => {
    // The template-literal type is what buys this; a plain brand would force a construction call.
    const text: NonBlankText = "Lesson notes";
    expect(text).toBe("Lesson notes");
  });

  it("keeps an operation's input type discoverable through its domain namespace", () => {
    const preserveInput = (
      input: Attendance.acknowledge.Input,
    ): Parameters<typeof Attendance.acknowledge>[0] => input;

    expect(preserveInput).toBeTypeOf("function");
  });
});
