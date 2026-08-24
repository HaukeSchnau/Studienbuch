import { Importing } from "@stu/core/importing";
import { Schedule } from "@stu/core/schedule";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import type { TimetableEntryPosition, TimetableEntryPositionResource } from "webuntis-api";
import { PlainDateSchema } from "@stu/core/foundation/plain-date";
import type { TimetableObservation } from "./timetable.ts";

export class InvalidTimetableOccurrence extends Schema.TaggedError<InvalidTimetableOccurrence>()(
  "WebUntis.InvalidTimetableOccurrence",
  {
    sourceExternalId: Schema.String,
    field: Schema.Literals(["Date", "StartTime", "EndTime", "TimeRange", "EntryIds"]),
    value: Schema.String,
  },
) {}

export interface ProjectTimetableOccurrencesInput {
  readonly dataSourceId: Importing.DataSourceId;
  readonly observations: ReadonlyArray<TimetableObservation>;
}

const sourceIdentity = (
  dataSourceId: Importing.DataSourceId,
  entityKind: Importing.ExternalEntityKind,
  externalId: string,
) =>
  Importing.SourceIdentity.make({
    dataSourceId,
    entityKind,
    externalId: Importing.ExternalId.make(externalId),
  });

const resource = (value: TimetableEntryPositionResource) => ({
  type: value.type,
  status: value.status,
  shortName: value.shortName,
  longName: value.longName,
  displayName: value.displayName,
  displayNameLabel: value.displayNameLabel ?? undefined,
});

const resourcePosition = (
  value: TimetableEntryPosition,
  position: number,
): Schedule.ProviderOccurrenceResourcePosition => {
  if (value.current !== null && value.removed !== null) {
    return Schedule.ProviderOccurrenceResourcePosition.make({
      _tag: "Replaced",
      position,
      current: resource(value.current),
      removed: resource(value.removed),
    });
  }
  if (value.current !== null) {
    return Schedule.ProviderOccurrenceResourcePosition.make({
      _tag: "Current",
      position,
      current: resource(value.current),
    });
  }
  if (value.removed !== null) {
    return Schedule.ProviderOccurrenceResourcePosition.make({
      _tag: "Removed",
      position,
      removed: resource(value.removed),
    });
  }
  return Schedule.ProviderOccurrenceResourcePosition.make({ _tag: "Empty", position });
};

const providerTimePattern = /^(?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2}))?$/;

const parseProviderTime = Effect.fnUntraced(function* (
  sourceExternalId: string,
  field: "StartTime" | "EndTime",
  value: string,
) {
  const groups = providerTimePattern.exec(value)?.groups;
  const hour = Number(groups?.hour);
  const minute = Number(groups?.minute);
  const second = groups?.second === undefined ? 0 : Number(groups.second);
  if (
    groups === undefined ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return yield* InvalidTimetableOccurrence.make({ sourceExternalId, field, value });
  }
  return yield* Schedule.LocalTime.Schema.makeEffect(
    ((hour * 60 + minute) * 60 + second) * 1_000,
  ).pipe(
    Effect.mapError(() => InvalidTimetableOccurrence.make({ sourceExternalId, field, value })),
  );
});

const parseProviderDate = Effect.fnUntraced(function* (sourceExternalId: string, value: string) {
  return yield* Schema.decodeEffect(PlainDateSchema)(value).pipe(
    Effect.mapError(() =>
      InvalidTimetableOccurrence.make({ sourceExternalId, field: "Date", value }),
    ),
  );
});

const projectClaim = Effect.fnUntraced(function* (
  dataSourceId: Importing.DataSourceId,
  observation: TimetableObservation,
) {
  const { entry, resource: viewedResource } = observation.payload;
  const [start, end] = yield* Effect.all([
    parseProviderTime(observation.externalId, "StartTime", entry.duration.start),
    parseProviderTime(observation.externalId, "EndTime", entry.duration.end),
  ]);
  const timeRange = yield* Schedule.LocalTimeRange.Schema.makeEffect({ start, end }).pipe(
    Effect.mapError(() =>
      InvalidTimetableOccurrence.make({
        sourceExternalId: observation.externalId,
        field: "TimeRange",
        value: `${entry.duration.start}/${entry.duration.end}`,
      }),
    ),
  );
  const positions = [entry.position1, entry.position2, entry.position3, entry.position4] as const;

  return Schedule.ProviderOccurrenceClaim.make({
    source: sourceIdentity(dataSourceId, "TimetableOccurrence", observation.externalId),
    academicYear: sourceIdentity(
      dataSourceId,
      "AcademicYear",
      observation.payload.academicYearExternalId,
    ),
    viewedResource: {
      source: sourceIdentity(dataSourceId, "ClassGroup", viewedResource.externalId),
      type: observation.payload.resourceType,
      shortName: viewedResource.shortName,
      longName: viewedResource.longName,
      displayName: viewedResource.displayName,
    },
    dayStatus: observation.payload.dayStatus,
    location: observation.payload.location,
    timeRange,
    type: entry.type,
    status: entry.status,
    resources: positions.flatMap((values, index) =>
      (values ?? []).map((value) => resourcePosition(value, index + 1)),
    ),
    notes: entry.notesAll,
    icons: entry.icons,
    texts: entry.texts,
    lessonText: entry.lessonText,
    lessonInfo: entry.lessonInfo ?? undefined,
    substitutionText: entry.substitutionText,
    presentation: {
      color: entry.color,
      layoutStartPosition: entry.layoutStartPosition,
      layoutWidth: entry.layoutWidth,
      layoutGroup: entry.layoutGroup,
    },
  });
});

interface ProjectedClaim {
  readonly date: PlainDate.Record;
  readonly providerEntryIds: readonly [Importing.ExternalId, ...Array<Importing.ExternalId>];
  readonly claim: Schedule.ProviderOccurrenceClaim;
}

const projectObservation = Effect.fnUntraced(function* (
  dataSourceId: Importing.DataSourceId,
  observation: TimetableObservation,
): Effect.fn.Return<ProjectedClaim, InvalidTimetableOccurrence> {
  const date = yield* parseProviderDate(observation.externalId, observation.payload.date);
  const firstId = observation.payload.entry.ids[0];
  if (firstId === undefined) {
    return yield* InvalidTimetableOccurrence.make({
      sourceExternalId: observation.externalId,
      field: "EntryIds",
      value: "[]",
    });
  }
  const providerEntryIds: [Importing.ExternalId, ...Array<Importing.ExternalId>] = [
    Importing.ExternalId.make(String(firstId)),
    ...observation.payload.entry.ids.slice(1).map((id) => Importing.ExternalId.make(String(id))),
  ];
  providerEntryIds.sort(Order.String);
  const claim = yield* projectClaim(dataSourceId, observation);
  return { date, providerEntryIds, claim };
});

const occurrenceKey = (projected: ProjectedClaim) =>
  JSON.stringify([
    projected.claim.source.dataSourceId,
    PlainDate.toString(projected.date),
    projected.providerEntryIds,
  ]);

/** Groups lossless class-view claims into provider-backed dated occurrences. */
export const projectTimetableOccurrences = Effect.fn("WebUntis.projectTimetableOccurrences")(
  function* (input: ProjectTimetableOccurrencesInput) {
    const projected = yield* Effect.forEach(input.observations, (observation) =>
      projectObservation(input.dataSourceId, observation),
    );
    const groups = new Map<string, Array<ProjectedClaim>>();
    for (const item of projected) {
      const key = occurrenceKey(item);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }

    return [...groups.values()]
      .map((group) => {
        const first = group[0];
        if (first === undefined) return undefined;
        const claims: [
          Schedule.ProviderOccurrenceClaim,
          ...Array<Schedule.ProviderOccurrenceClaim>,
        ] = [first.claim, ...group.slice(1).map((item) => item.claim)];
        claims.sort((left, right) => Order.String(left.source.externalId, right.source.externalId));
        return Schedule.ProviderBackedOccurrence.make({
          id: Schedule.providerBackedOccurrenceId({
            dataSourceId: input.dataSourceId,
            date: first.date,
            providerEntryIds: first.providerEntryIds,
          }),
          dataSourceId: input.dataSourceId,
          date: first.date,
          providerEntryIds: first.providerEntryIds,
          courseOfferingIds: [],
          claims,
        });
      })
      .filter(
        (occurrence): occurrence is Schedule.ProviderBackedOccurrence => occurrence !== undefined,
      )
      .sort((left, right) => Order.String(left.id, right.id));
  },
);
