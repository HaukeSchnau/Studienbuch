import {
  AggregateRevision as AggregateRevisionFromRoot,
  Artifact as ArtifactFromRoot,
  Assessment as AssessmentFromRoot,
  Attendance as AttendanceFromRoot,
  CalendarDateRange as CalendarDateRangeFromRoot,
  Importing as ImportingFromRoot,
  NonBlankText as NonBlankTextFromRoot,
  PlainDateSchema as PlainDateSchemaFromRoot,
  Organization as OrganizationFromRoot,
  Schedule as ScheduleFromRoot,
  Tasks as TasksFromRoot,
} from "@stu/core";
import { Assessment } from "@stu/core/assessment";
import { Attendance } from "@stu/core/attendance";
import { AggregateRevision } from "@stu/core/foundation/aggregate-revision";
import { Artifact } from "@stu/core/foundation/artifact";
import { PlainDateSchema } from "@stu/core/foundation/plain-date";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "@stu/core/foundation/calendar-date-range";
import { NonBlankText } from "@stu/core/foundation/non-blank-text";
import {
  AggregateRevision as AggregateRevisionFromFoundation,
  Artifact as ArtifactFromFoundation,
  CalendarDateRange as CalendarDateRangeFromFoundation,
  NonBlankText as NonBlankTextFromFoundation,
  PlainDateSchema as PlainDateSchemaFromFoundation,
} from "@stu/core/foundation";
import { Importing } from "@stu/core/importing";
import { Organization } from "@stu/core/organization";
import { LocalTime } from "@stu/core/schedule/local-time";
import { LocalTimeRange } from "@stu/core/schedule/local-time-range";
import { Schedule } from "@stu/core/schedule";
import { Tasks } from "@stu/core/tasks";
import { describe, expect, it } from "vite-plus/test";

const preserveAttendanceInput = (
  input: Attendance.acknowledge.Input,
): Parameters<typeof Attendance.acknowledge>[0] => input;

describe("public namespace exports", () => {
  it("exposes each domain as the same namespace from the root and its subpath", () => {
    expect(Assessment.GradeValue).toBe(AssessmentFromRoot.GradeValue);
    expect(Attendance.acknowledge).toBe(AttendanceFromRoot.acknowledge);
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
    const date: PlainDate.Record = PlainDate.fromString("2026-08-16", Calendar.getBasic);
    const dateRange: CalendarDateRange.Type = CalendarDateRange.Schema.make({
      start: date,
      end: date,
    });
    const text: NonBlankText.Type = "Lesson notes";
    const start: LocalTime.Type = LocalTime.Schema.make(28_800_000);
    const end: LocalTime.Type = LocalTime.Schema.make(31_500_000);
    const timeRange: LocalTimeRange.Type = LocalTimeRange.Schema.make({ start, end });

    expect(revision).toBe(0);
    expect(artifact.id).toBe("artifact-1");
    expect(CalendarDateRange.contains(dateRange, date)).toBe(true);
    expect(text).toBe("Lesson notes");
    expect(LocalTimeRange.contains(timeRange, start)).toBe(true);

    expect(AggregateRevision.Schema).toBe(AggregateRevisionFromRoot.Schema);
    expect(AggregateRevision.Schema).toBe(AggregateRevisionFromFoundation.Schema);
    expect(Artifact.Reference).toBe(ArtifactFromRoot.Reference);
    expect(Artifact.Reference).toBe(ArtifactFromFoundation.Reference);
    expect(PlainDateSchema).toBe(PlainDateSchemaFromRoot);
    expect(PlainDateSchema).toBe(PlainDateSchemaFromFoundation);
    expect(CalendarDateRange.Schema).toBe(CalendarDateRangeFromRoot.Schema);
    expect(CalendarDateRange.Schema).toBe(CalendarDateRangeFromFoundation.Schema);
    expect(NonBlankText.Schema).toBe(NonBlankTextFromRoot.Schema);
    expect(NonBlankText.Schema).toBe(NonBlankTextFromFoundation.Schema);
    expect(LocalTime.Schema).toBe(Schedule.LocalTime.Schema);
    expect(LocalTimeRange.Schema).toBe(Schedule.LocalTimeRange.Schema);
  });

  it("keeps operation companion types discoverable through a domain namespace", () => {
    expect(preserveAttendanceInput).toBeTypeOf("function");
  });
});
