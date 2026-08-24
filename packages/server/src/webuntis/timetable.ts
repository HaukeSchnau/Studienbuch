import * as EffectArray from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import {
  AppClient,
  SchoolyearsClient,
  TimetableClient,
  webUntisLayer,
  withSchoolYear,
  type DisplayResource,
  type Schoolyear,
  type TimetableEntries,
  type TimetableEntry,
  type TimetableEntryDay,
  type TimetableEntryPosition,
} from "webuntis-api";
import { TimetableEntrySchema } from "webuntis-api/schemas";
import { hashSourceObservations, type SourceSnapshot } from "../importing/source-snapshot.ts";
import { SchoolYearUnavailable } from "./directory-preview.ts";

const timetableBatchSize = 10;

export class InvalidTimetableRange extends Schema.TaggedError<InvalidTimetableRange>()(
  "WebUntis.InvalidTimetableRange",
  {
    start: Schema.String,
    end: Schema.String,
    reason: Schema.Literals(["InvalidDate", "StartAfterEnd", "OutsideSchoolYear"]),
  },
) {}

export type TimetableDiagnosticCode =
  | "ConflictingEntryIdentity"
  | "DuplicateResourceDay"
  | "EntryWithoutId"
  | "MissingResourceDay"
  | "NotAllowedResourceDay"
  | "ResponseError"
  | "UnexpectedResourceDay";

export type TimetableDiagnostic = {
  readonly severity: "Warning" | "Error";
  readonly code: TimetableDiagnosticCode;
  readonly count: number;
  readonly date?: string | undefined;
};

export interface TimetableDayPreview {
  readonly date: string;
  readonly completeness: "Complete" | "Partial";
  readonly expectedClassRows: number;
  readonly returnedClassRows: number;
  readonly occurrenceViews: number;
  readonly dayStatuses: Readonly<Record<string, number>>;
  readonly entryStatuses: Readonly<Record<string, number>>;
  readonly entryTypes: Readonly<Record<string, number>>;
  readonly entryLocations: {
    readonly day: number;
    readonly grid: number;
    readonly back: number;
  };
  readonly diagnostics: ReadonlyArray<TimetableDiagnostic>;
}

export interface TimetablePreview {
  readonly dataSourceId: string;
  readonly provider: "WebUntis";
  readonly academicYear: {
    readonly externalId: string;
    readonly name: string;
    readonly start: string;
    readonly end: string;
  };
  readonly requestedRange: { readonly start: string; readonly end: string };
  readonly resourceType: "CLASS";
  readonly classCount: number;
  readonly responseCount: number;
  readonly responseErrorCount: number;
  readonly completeDays: number;
  readonly partialDays: number;
  readonly wouldImport: { readonly occurrenceViews: number };
  readonly days: ReadonlyArray<TimetableDayPreview>;
  readonly diagnostics: ReadonlyArray<TimetableDiagnostic>;
}

export interface TimetableInventory {
  readonly dataSourceId: string;
  readonly academicYear: Schoolyear;
  readonly requestedRange: { readonly start: string; readonly end: string };
  readonly requestedDates: ReadonlyArray<string>;
  readonly classes: ReadonlyArray<DisplayResource>;
  readonly responses: ReadonlyArray<TimetableEntries>;
}

type TimetableEntryLocation = "Back" | "Day" | "Grid";

export const TimetableObservation = Schema.TaggedStruct("TimetableOccurrence", {
  externalId: Schema.String,
  payload: Schema.Struct({
    academicYearExternalId: Schema.String,
    date: Schema.String,
    resourceType: Schema.Literal("CLASS"),
    resource: Schema.Struct({
      externalId: Schema.String,
      shortName: Schema.String,
      longName: Schema.String,
      displayName: Schema.String,
    }),
    dayStatus: Schema.String,
    location: Schema.Literals(["Back", "Day", "Grid"]),
    entry: TimetableEntrySchema,
  }),
});
export type TimetableObservation = typeof TimetableObservation.Type;

export interface TimetableImportPlan {
  readonly preview: TimetablePreview;
  readonly snapshots: ReadonlyArray<SourceSnapshot<TimetableObservation>>;
}

interface DayState {
  readonly date: string;
  readonly resourceRowCounts: Map<number, number>;
  readonly observations: Map<string, TimetableObservation>;
  readonly conflictingIdentities: Set<string>;
  readonly dayStatuses: Map<string, number>;
  readonly entryStatuses: Map<string, number>;
  readonly entryTypes: Map<string, number>;
  readonly entryLocations: { day: number; grid: number; back: number };
  readonly diagnostics: Map<TimetableDiagnosticCode, number>;
}

const parsePlainDate = Effect.fn("WebUntis.parseTimetableDate")(function* (
  start: string,
  end: string,
  value: string,
) {
  return yield* Effect.try({
    try: () => PlainDate.fromString(value, Calendar.getBasic),
    catch: () => InvalidTimetableRange.make({ start, end, reason: "InvalidDate" }),
  });
});

const requestedDates = Effect.fn("WebUntis.requestedTimetableDates")(function* (
  start: string,
  end: string,
  academicYear: Schoolyear,
) {
  const [first, last, yearStart, yearEnd] = yield* Effect.all([
    parsePlainDate(start, end, start),
    parsePlainDate(start, end, end),
    parsePlainDate(start, end, academicYear.dateRange.start),
    parsePlainDate(start, end, academicYear.dateRange.end),
  ]);
  if (PlainDate.compare(first, last) > 0) {
    return yield* InvalidTimetableRange.make({ start, end, reason: "StartAfterEnd" });
  }
  if (PlainDate.compare(first, yearStart) < 0 || PlainDate.compare(last, yearEnd) > 0) {
    return yield* InvalidTimetableRange.make({ start, end, reason: "OutsideSchoolYear" });
  }

  return Array.from({ length: PlainDate.diffDays(first, last) + 1 }, (_, offset) =>
    PlainDate.toString(PlainDate.addDays(first, offset)),
  );
});

const increment = (counts: Map<string, number>, value: string, amount = 1) => {
  counts.set(value, (counts.get(value) ?? 0) + amount);
};

const incrementDiagnostic = (
  diagnostics: Map<TimetableDiagnosticCode, number>,
  code: TimetableDiagnosticCode,
  amount = 1,
) => {
  if (amount === 0) return;
  diagnostics.set(code, (diagnostics.get(code) ?? 0) + amount);
};

const sortedCounts = (counts: Map<string, number>): Readonly<Record<string, number>> =>
  Object.fromEntries([...counts.entries()].sort(([left], [right]) => (left < right ? -1 : 1)));

const compareJson = <Value>(left: Value, right: Value) => {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
};

const normalizePositions = (
  positions: ReadonlyArray<TimetableEntryPosition> | null,
): ReadonlyArray<TimetableEntryPosition> | null =>
  positions === null ? null : [...positions].sort(compareJson);

const normalizeEntry = (entry: TimetableEntry): TimetableEntry => ({
  ...entry,
  ids: [...entry.ids].sort((left, right) => left - right),
  icons: [...entry.icons].sort(),
  position1: normalizePositions(entry.position1) ?? [],
  position2: normalizePositions(entry.position2),
  position3: normalizePositions(entry.position3),
  position4: normalizePositions(entry.position4),
  texts: [...entry.texts].sort(compareJson),
});

const resourceReference = (resource: DisplayResource) => ({
  externalId: String(resource.id),
  shortName: resource.shortName,
  longName: resource.longName,
  displayName: resource.displayName,
});

const externalIdOf = (day: TimetableEntryDay, entry: TimetableEntry) =>
  `CLASS:${day.resource.id}:${day.date}:${entry.ids.join(",")}`;

const diagnosticRows = (
  diagnostics: Map<TimetableDiagnosticCode, number>,
  date?: string,
): ReadonlyArray<TimetableDiagnostic> =>
  [...diagnostics.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([code, count]) => ({
      severity: code === "UnexpectedResourceDay" ? "Warning" : "Error",
      code,
      count,
      date,
    }));

const emptyDayState = (date: string): DayState => ({
  date,
  resourceRowCounts: new Map(),
  observations: new Map(),
  conflictingIdentities: new Set(),
  dayStatuses: new Map(),
  entryStatuses: new Map(),
  entryTypes: new Map(),
  entryLocations: { day: 0, grid: 0, back: 0 },
  diagnostics: new Map(),
});

const addEntries = (
  state: DayState,
  academicYearExternalId: string,
  day: TimetableEntryDay,
  location: TimetableEntryLocation,
  entries: ReadonlyArray<TimetableEntry>,
) => {
  switch (location) {
    case "Back":
      state.entryLocations.back += entries.length;
      break;
    case "Day":
      state.entryLocations.day += entries.length;
      break;
    case "Grid":
      state.entryLocations.grid += entries.length;
      break;
  }
  for (const rawEntry of entries) {
    increment(state.entryStatuses, rawEntry.status);
    increment(state.entryTypes, rawEntry.type);
    if (rawEntry.ids.length === 0) {
      incrementDiagnostic(state.diagnostics, "EntryWithoutId");
      continue;
    }

    const entry = normalizeEntry(rawEntry);
    const externalId = externalIdOf(day, entry);
    if (state.conflictingIdentities.has(externalId)) continue;
    const observation: TimetableObservation = {
      _tag: "TimetableOccurrence",
      externalId,
      payload: {
        academicYearExternalId,
        date: day.date,
        resourceType: "CLASS",
        resource: resourceReference(day.resource),
        dayStatus: day.status,
        location,
        entry,
      },
    };
    const previous = state.observations.get(externalId);
    if (previous === undefined) {
      state.observations.set(externalId, observation);
    } else if (JSON.stringify(previous) !== JSON.stringify(observation)) {
      state.observations.delete(externalId);
      state.conflictingIdentities.add(externalId);
      incrementDiagnostic(state.diagnostics, "ConflictingEntryIdentity");
    }
  }
};

/** Converts decoded class timetable views into independently reconcilable daily snapshots. */
export const makeTimetableImportPlan = (inventory: TimetableInventory): TimetableImportPlan => {
  const academicYearExternalId = String(inventory.academicYear.id);
  const expectedClassIds = new Set(inventory.classes.map((resource) => resource.id));
  const days = new Map(inventory.requestedDates.map((date) => [date, emptyDayState(date)]));
  const overallDiagnostics = new Map<TimetableDiagnosticCode, number>();
  const responseErrorCount = inventory.responses.reduce(
    (count, response) => count + response.errors.length,
    0,
  );

  for (const response of inventory.responses) {
    for (const day of response.days) {
      const state = days.get(day.date);
      if (
        state === undefined ||
        day.resourceType !== "CLASS" ||
        !expectedClassIds.has(day.resource.id)
      ) {
        incrementDiagnostic(overallDiagnostics, "UnexpectedResourceDay");
        continue;
      }

      state.resourceRowCounts.set(
        day.resource.id,
        (state.resourceRowCounts.get(day.resource.id) ?? 0) + 1,
      );
      increment(state.dayStatuses, day.status);
      if (day.status === "NOT_ALLOWED" || day.status === "NOT_ALLOWED_FOR_RESOURCE") {
        incrementDiagnostic(state.diagnostics, "NotAllowedResourceDay");
      }
      addEntries(state, academicYearExternalId, day, "Day", day.dayEntries);
      addEntries(state, academicYearExternalId, day, "Grid", day.gridEntries);
      addEntries(state, academicYearExternalId, day, "Back", day.backEntries);
    }
  }

  const snapshots: Array<SourceSnapshot<TimetableObservation>> = [];
  const dayPreviews: Array<TimetableDayPreview> = [];
  for (const state of days.values()) {
    const missingRows = [...expectedClassIds].filter(
      (classId) => !state.resourceRowCounts.has(classId),
    ).length;
    const duplicateRows = [...state.resourceRowCounts.values()].filter((count) => count > 1).length;
    incrementDiagnostic(state.diagnostics, "MissingResourceDay", missingRows);
    incrementDiagnostic(state.diagnostics, "DuplicateResourceDay", duplicateRows);
    incrementDiagnostic(state.diagnostics, "ResponseError", responseErrorCount);

    const observations = [...state.observations.values()].sort((left, right) =>
      left.externalId < right.externalId ? -1 : left.externalId > right.externalId ? 1 : 0,
    );
    const completeness = state.diagnostics.size === 0 ? "Complete" : "Partial";
    const diagnostics = diagnosticRows(state.diagnostics, state.date);
    const counts = {
      expectedClassRows: expectedClassIds.size,
      returnedClassRows: state.resourceRowCounts.size,
      occurrenceViews: observations.length,
      dayStatuses: sortedCounts(state.dayStatuses),
      entryStatuses: sortedCounts(state.entryStatuses),
      entryTypes: sortedCounts(state.entryTypes),
      entryLocations: state.entryLocations,
    } as const;
    snapshots.push({
      provider: "WebUntis",
      dataSourceId: inventory.dataSourceId,
      dataset: "timetable",
      scope: `academic-year:${academicYearExternalId}/resource-type:CLASS/date:${state.date}`,
      contentHash: hashSourceObservations(observations),
      completeness,
      observations,
      counts,
      diagnostics,
    });
    dayPreviews.push({
      date: state.date,
      completeness,
      expectedClassRows: expectedClassIds.size,
      returnedClassRows: state.resourceRowCounts.size,
      occurrenceViews: observations.length,
      dayStatuses: counts.dayStatuses,
      entryStatuses: counts.entryStatuses,
      entryTypes: counts.entryTypes,
      entryLocations: state.entryLocations,
      diagnostics,
    });
  }

  return {
    preview: {
      dataSourceId: inventory.dataSourceId,
      provider: "WebUntis",
      academicYear: {
        externalId: academicYearExternalId,
        name: inventory.academicYear.name,
        start: inventory.academicYear.dateRange.start,
        end: inventory.academicYear.dateRange.end,
      },
      requestedRange: inventory.requestedRange,
      resourceType: "CLASS",
      classCount: expectedClassIds.size,
      responseCount: inventory.responses.length,
      responseErrorCount,
      completeDays: dayPreviews.filter((day) => day.completeness === "Complete").length,
      partialDays: dayPreviews.filter((day) => day.completeness === "Partial").length,
      wouldImport: {
        occurrenceViews: dayPreviews.reduce((count, day) => count + day.occurrenceViews, 0),
      },
      days: dayPreviews,
      diagnostics: diagnosticRows(overallDiagnostics),
    },
    snapshots,
  };
};

/** Fetches class timetable views in bounded batches and performs no persistence. */
export const fetchTimetableImportPlan = Effect.fn("WebUntis.fetchTimetableImportPlan")(function* (
  requestedSchoolYear: string,
  start: string,
  end: string,
) {
  const app = yield* AppClient;
  const schoolyears = yield* SchoolyearsClient;
  const timetable = yield* TimetableClient;
  const [appData, availableSchoolYears] = yield* Effect.all([app.getData, schoolyears.list]);
  const academicYear = availableSchoolYears.find((year) => year.name === requestedSchoolYear);
  if (academicYear === undefined) {
    return yield* SchoolYearUnavailable.make({
      requested: requestedSchoolYear,
      available: availableSchoolYears.map((year) => year.name),
    });
  }
  const dates = yield* requestedDates(start, end, academicYear);
  const request = { start, end, resourceType: "CLASS", timetableType: "STANDARD" } as const;
  const filter = yield* timetable.getFilter(request).pipe(withSchoolYear(academicYear.id));
  const classes = filter.classes
    .map((item) => item.class)
    .sort((left, right) => left.id - right.id);
  const responses = yield* Effect.all(
    EffectArray.chunksOf(
      classes.map((resource) => resource.id),
      timetableBatchSize,
    ).map((resources) =>
      timetable.getEntries({ ...request, resources }).pipe(withSchoolYear(academicYear.id)),
    ),
    { concurrency: 3 },
  );

  return makeTimetableImportPlan({
    dataSourceId: `webuntis:${appData.tenant.id}`,
    academicYear,
    requestedRange: { start, end },
    requestedDates: dates,
    classes,
    responses,
  });
});

export const layer = webUntisLayer;

export {
  InvalidTimetableOccurrence,
  projectTimetableOccurrences,
  type ProjectTimetableOccurrencesInput,
} from "./timetable-projection.ts";

export * as WebUntisTimetable from "./timetable.ts";
