import { Importing, Schedule } from "@stu/core";
import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";

const dataSourceId = Importing.DataSourceId.make("webuntis:school-1");
const date = PlainDate.fromString("2026-08-24", Calendar.getBasic);

const source = (externalId: string) =>
  Importing.SourceIdentity.make({
    dataSourceId,
    entityKind: "TimetableOccurrence",
    externalId: Importing.ExternalId.make(externalId),
  });

const claim = (externalId: string) =>
  Schedule.ProviderOccurrenceClaim.make({
    source: source(externalId),
    academicYear: Importing.SourceIdentity.make({
      dataSourceId,
      entityKind: "AcademicYear",
      externalId: Importing.ExternalId.make("10"),
    }),
    viewedResource: {
      source: Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "ClassGroup",
        externalId: Importing.ExternalId.make("1"),
      }),
      type: "CLASS",
      shortName: "10a",
      longName: "Klasse 10a",
      displayName: "10a",
    },
    dayStatus: "REGULAR",
    location: "Grid",
    timeRange: Schedule.LocalTimeRange.Schema.make({
      start: Schedule.LocalTime.Schema.make(28_800_000),
      end: Schedule.LocalTime.Schema.make(32_400_000),
    }),
    type: "NORMAL_TEACHING_PERIOD",
    status: "CHANGED",
    resources: [
      Schedule.ProviderOccurrenceResourcePosition.make({
        _tag: "Replaced",
        position: 1,
        current: {
          type: "TEACHER",
          status: "ADDED",
          shortName: "NEW",
          longName: "New teacher",
          displayName: "New teacher",
        },
        removed: {
          type: "TEACHER",
          status: "REMOVED",
          shortName: "OLD",
          longName: "Old teacher",
          displayName: "Old teacher",
        },
      }),
      Schedule.ProviderOccurrenceResourcePosition.make({ _tag: "Empty", position: 4 }),
    ],
    notes: "Bring the workbook",
    icons: ["NOTES"],
    texts: [{ type: "INFO", text: "Room moved" }],
    lessonText: "Chapter 4",
    substitutionText: "Replacement teacher",
    presentation: {
      color: "#ffffff",
      layoutStartPosition: 0,
      layoutWidth: 1,
      layoutGroup: 0,
    },
  });

describe("provider-backed dated occurrences", () => {
  it("keeps provider claims and optional domain links separate", () => {
    const providerEntryIds = [
      Importing.ExternalId.make("101"),
      Importing.ExternalId.make("102"),
    ] as const;
    const occurrence = Schedule.ProviderBackedOccurrence.make({
      id: Schedule.providerBackedOccurrenceId({ dataSourceId, date, providerEntryIds }),
      dataSourceId,
      date,
      providerEntryIds,
      recurringMeetingId: Schedule.RecurringMeetingId.make("meeting-1"),
      courseOfferingIds: [],
      claims: [claim("CLASS:1:2026-08-24:101,102")],
    });

    expect(occurrence.id).toBe(
      Schedule.providerBackedOccurrenceId({
        dataSourceId,
        date,
        providerEntryIds: [...providerEntryIds].reverse(),
      }),
    );
    expect(occurrence.claims[0]?.resources).toMatchObject([
      { _tag: "Replaced", position: 1 },
      { _tag: "Empty", position: 4 },
    ]);
    expect(occurrence.claims[0]?.notes).toBe("Bring the workbook");
    expect(occurrence.recurringMeetingId).toBe("meeting-1");
    expect(occurrence.courseOfferingIds).toEqual([]);
    const encoded = Schema.encodeSync(Schedule.ProviderBackedOccurrence)(occurrence);
    expect(encoded.date).toBe("2026-08-24");
    expect(Schema.decodeSync(Schedule.ProviderBackedOccurrence)(encoded).id).toBe(occurrence.id);
  });

  it("rejects duplicate source claims instead of silently collapsing them", () => {
    const duplicate = claim("CLASS:1:2026-08-24:101");
    expect(() =>
      Schedule.ProviderBackedOccurrence.make({
        id: Schedule.DatedOccurrenceId.make("occurrence-1"),
        dataSourceId,
        date,
        providerEntryIds: [Importing.ExternalId.make("101")],
        courseOfferingIds: [],
        claims: [duplicate, duplicate],
      }),
    ).toThrow("Schema validation failed");
  });
});
