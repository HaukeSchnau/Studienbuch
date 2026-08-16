import {
  Assessment as AssessmentFromRoot,
  Attendance as AttendanceFromRoot,
  Foundation as FoundationFromRoot,
  Importing as ImportingFromRoot,
  Organization as OrganizationFromRoot,
  Schedule as ScheduleFromRoot,
  Tasks as TasksFromRoot,
} from "@stu/core";
import { Assessment } from "@stu/core/assessment";
import { Attendance } from "@stu/core/attendance";
import { AggregateRevision } from "@stu/core/foundation/aggregate-revision";
import { Artifact } from "@stu/core/foundation/artifact";
import { CalendarDate } from "@stu/core/foundation/calendar-date";
import { CalendarDateRange } from "@stu/core/foundation/calendar-date-range";
import { NonBlankText } from "@stu/core/foundation/non-blank-text";
import { Foundation } from "@stu/core/foundation";
import { Importing } from "@stu/core/importing";
import { Organization } from "@stu/core/organization";
import { LocalTime } from "@stu/core/schedule/local-time";
import { LocalTimeRange } from "@stu/core/schedule/local-time-range";
import { Schedule } from "@stu/core/schedule";
import { Tasks } from "@stu/core/tasks";
import { describe, expect, it } from "vite-plus/test";

describe("public namespace exports", () => {
  it("exposes each domain as the same namespace from the root and its subpath", () => {
    expect(Assessment.GradeValue).toBe(AssessmentFromRoot.GradeValue);
    expect(Attendance.acknowledge).toBe(AttendanceFromRoot.acknowledge);
    expect(Foundation.CalendarDate.Schema).toBe(FoundationFromRoot.CalendarDate.Schema);
    expect(Importing.SourceRevision.Schema).toBe(ImportingFromRoot.SourceRevision.Schema);
    expect(Organization.Person).toBe(OrganizationFromRoot.Person);
    expect(Schedule.LocalTime.Schema).toBe(ScheduleFromRoot.LocalTime.Schema);
    expect(Tasks.SchoolTask).toBe(TasksFromRoot.SchoolTask);
  });

  it("exposes focused leaves as named namespaces with runtime and type members", () => {
    const revision: AggregateRevision.Type = AggregateRevision.initial;
    const artifact: Artifact.Reference = Artifact.Reference.make({
      id: Artifact.Id.make("artifact-1"),
      mediaType: Artifact.MediaType.make("application/pdf"),
    });
    const date: CalendarDate.Type = CalendarDate.unsafeFromString("2026-08-16");
    const dateRange: CalendarDateRange.Type = CalendarDateRange.Schema.make({
      start: date,
      end: date,
    });
    const text: NonBlankText.Type = NonBlankText.Schema.make("Lesson notes");
    const start: LocalTime.Type = LocalTime.unsafeFromString("08:00");
    const end: LocalTime.Type = LocalTime.unsafeFromString("08:45");
    const timeRange: LocalTimeRange.Type = LocalTimeRange.Schema.make({ start, end });

    expect(revision).toBe(0);
    expect(artifact.id).toBe("artifact-1");
    expect(CalendarDateRange.contains(dateRange, date)).toBe(true);
    expect(text).toBe("Lesson notes");
    expect(LocalTimeRange.contains(timeRange, start)).toBe(true);

    expect(AggregateRevision.Schema).toBe(Foundation.AggregateRevision.Schema);
    expect(Artifact.Reference).toBe(Foundation.Artifact.Reference);
    expect(CalendarDate.Schema).toBe(Foundation.CalendarDate.Schema);
    expect(CalendarDateRange.Schema).toBe(Foundation.CalendarDateRange.Schema);
    expect(NonBlankText.Schema).toBe(Foundation.NonBlankText.Schema);
    expect(LocalTime.Schema).toBe(Schedule.LocalTime.Schema);
    expect(LocalTimeRange.Schema).toBe(Schedule.LocalTimeRange.Schema);
  });

  it("keeps operation companion types discoverable through a domain namespace", () => {
    const preserveInput = (
      input: Attendance.acknowledge.Input,
    ): Parameters<typeof Attendance.acknowledge>[0] => input;

    expect(preserveInput).toBeTypeOf("function");
  });
});
