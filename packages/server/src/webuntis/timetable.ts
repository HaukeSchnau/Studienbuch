import { Importing } from "@stu/core";
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
  type TimetableFilter,
  type TimetableResourceType,
} from "webuntis-api";
import { TimetableEntrySchema } from "webuntis-api/schemas";
import { hashSourceObservations, type SourceSnapshot } from "../importing/source-snapshot.ts";
import {
  makeCourseIdentityAudit,
  type CourseIdentityAuditPeriod,
} from "./course-identity-audit.ts";
import { SchoolYearUnavailable } from "./directory-preview.ts";
import { findSchoolProfile } from "./school-profile.ts";
import { projectTimetableOccurrences } from "./timetable-projection.ts";

export const timetableResourceBatchSize = 500;

export const importedTimetableResourceTypes = ["CLASS", "SUBJECT", "TEACHER", "ROOM"] as const;
export type ImportedTimetableResourceType = (typeof importedTimetableResourceTypes)[number];

const isImportedTimetableDay = (
  day: TimetableEntryDay,
): day is TimetableEntryDay & { readonly resourceType: ImportedTimetableResourceType } => {
  switch (day.resourceType) {
    case "CLASS":
    case "SUBJECT":
    case "TEACHER":
    case "ROOM":
      return true;
    case "RESOURCE":
    case "STUDENT":
      return false;
  }
};

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
  readonly expectedResourceRows: number;
  readonly returnedResourceRows: number;
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
  readonly school: {
    readonly externalId: string;
    readonly name: string;
    readonly loginName: string;
  };
  readonly academicYear: {
    readonly externalId: string;
    readonly name: string;
    readonly start: string;
    readonly end: string;
  };
  readonly requestedRange: { readonly start: string; readonly end: string };
  readonly resourceTypes: ReadonlyArray<ImportedTimetableResourceType>;
  readonly resourceCounts: Readonly<Record<ImportedTimetableResourceType, number>>;
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
  readonly school: TimetablePreview["school"];
  readonly academicYear: Schoolyear;
  readonly requestedRange: { readonly start: string; readonly end: string };
  readonly requestedDates: ReadonlyArray<string>;
  readonly resources: Readonly<
    Record<ImportedTimetableResourceType, ReadonlyArray<DisplayResource>>
  >;
  readonly responses: ReadonlyArray<TimetableEntries>;
}

type TimetableEntryLocation = "Back" | "Day" | "Grid";

export const TimetableObservation = Schema.TaggedStruct("TimetableOccurrence", {
  externalId: Schema.String,
  payload: Schema.Struct({
    academicYearExternalId: Schema.String,
    date: Schema.String,
    resourceType: Schema.Literals(importedTimetableResourceTypes),
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
  readonly resourceRowCounts: Map<string, number>;
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

export const requestedTimetableDates = Effect.fn("WebUntis.requestedTimetableDates")(function* (
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

export const normalizeTimetableEntry = (entry: TimetableEntry): TimetableEntry => ({
  ...entry,
  ids: [...entry.ids].sort((left, right) => left - right),
  icons: [...entry.icons].sort(),
  position1: normalizePositions(entry.position1),
  position2: normalizePositions(entry.position2),
  position3: normalizePositions(entry.position3),
  position4: normalizePositions(entry.position4),
  texts: [...entry.texts].sort(compareJson),
});

export const timetableResourceReference = (resource: DisplayResource) => ({
  externalId: String(resource.id),
  shortName: resource.shortName,
  longName: resource.longName,
  displayName: resource.displayName,
});

export const timetableEntryExternalId = (day: TimetableEntryDay, entry: TimetableEntry) =>
  `${day.resourceType}:${day.resource.id}:${day.date}:${entry.ids.join(",")}`;

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
  day: TimetableEntryDay & { readonly resourceType: ImportedTimetableResourceType },
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

    const entry = normalizeTimetableEntry(rawEntry);
    const externalId = timetableEntryExternalId(day, entry);
    if (state.conflictingIdentities.has(externalId)) continue;
    const observation: TimetableObservation = {
      _tag: "TimetableOccurrence",
      externalId,
      payload: {
        academicYearExternalId,
        date: day.date,
        resourceType: day.resourceType,
        resource: timetableResourceReference(day.resource),
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

const resourceKey = (resourceType: TimetableResourceType, resourceId: number) =>
  `${resourceType}:${resourceId}`;

/** Converts decoded timetable views into independently reconcilable daily snapshots. */
export const makeTimetableImportPlan = (inventory: TimetableInventory): TimetableImportPlan => {
  const academicYearExternalId = String(inventory.academicYear.id);
  const expectedResourceKeys = new Set(
    importedTimetableResourceTypes.flatMap((resourceType) =>
      inventory.resources[resourceType].map((resource) => resourceKey(resourceType, resource.id)),
    ),
  );
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
        !isImportedTimetableDay(day) ||
        !expectedResourceKeys.has(resourceKey(day.resourceType, day.resource.id))
      ) {
        incrementDiagnostic(overallDiagnostics, "UnexpectedResourceDay");
        continue;
      }

      const key = resourceKey(day.resourceType, day.resource.id);
      state.resourceRowCounts.set(key, (state.resourceRowCounts.get(key) ?? 0) + 1);
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
    const missingRows = [...expectedResourceKeys].filter(
      (key) => !state.resourceRowCounts.has(key),
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
      expectedResourceRows: expectedResourceKeys.size,
      returnedResourceRows: state.resourceRowCounts.size,
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
      scope: `academic-year:${academicYearExternalId}/resource-types:${importedTimetableResourceTypes.join(",")}/date:${state.date}`,
      contentHash: hashSourceObservations(observations),
      completeness,
      observations,
      counts,
      diagnostics,
    });
    dayPreviews.push({
      date: state.date,
      completeness,
      expectedResourceRows: expectedResourceKeys.size,
      returnedResourceRows: state.resourceRowCounts.size,
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
      school: inventory.school,
      academicYear: {
        externalId: academicYearExternalId,
        name: inventory.academicYear.name,
        start: inventory.academicYear.dateRange.start,
        end: inventory.academicYear.dateRange.end,
      },
      requestedRange: inventory.requestedRange,
      resourceTypes: importedTimetableResourceTypes,
      resourceCounts: {
        CLASS: inventory.resources.CLASS.length,
        SUBJECT: inventory.resources.SUBJECT.length,
        TEACHER: inventory.resources.TEACHER.length,
        ROOM: inventory.resources.ROOM.length,
      },
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

const resourcesFor = (
  resourceType: ImportedTimetableResourceType,
  filter: TimetableFilter,
): ReadonlyArray<DisplayResource> => {
  switch (resourceType) {
    case "CLASS":
      return filter.classes.map((item) => item.class);
    case "SUBJECT":
      return filter.subjects.map((item) => item.subject);
    case "TEACHER":
      return filter.teachers.map((item) => item.teacher);
    case "ROOM":
      return filter.rooms.map((item) => item.room);
  }
};

/** Fetches identity-bearing timetable views in bounded batches and performs no persistence. */
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
  const dates = yield* requestedTimetableDates(start, end, academicYear);
  const filteredResources = yield* Effect.forEach(
    importedTimetableResourceTypes,
    (resourceType) => {
      const request = { start, end, resourceType, timetableType: "STANDARD" } as const;
      return timetable.getFilter(request).pipe(
        withSchoolYear(academicYear.id),
        Effect.map(
          (filter) =>
            [
              resourceType,
              [...resourcesFor(resourceType, filter)].sort((left, right) => left.id - right.id),
            ] as const,
        ),
      );
    },
    { concurrency: 4 },
  );
  const resourceMap = new Map(filteredResources);
  const resources: TimetableInventory["resources"] = {
    CLASS: resourceMap.get("CLASS") ?? [],
    SUBJECT: resourceMap.get("SUBJECT") ?? [],
    TEACHER: resourceMap.get("TEACHER") ?? [],
    ROOM: resourceMap.get("ROOM") ?? [],
  };
  const entryRequests = importedTimetableResourceTypes.flatMap((resourceType) =>
    EffectArray.chunksOf(
      resources[resourceType].map((resource) => resource.id),
      timetableResourceBatchSize,
    ).map((resourceIds) => ({ resourceType, resourceIds })),
  );
  const responses = yield* Effect.forEach(
    entryRequests,
    ({ resourceType, resourceIds }) =>
      timetable
        .getEntries({
          start,
          end,
          resourceType,
          resources: resourceIds,
          timetableType: "STANDARD",
        })
        .pipe(withSchoolYear(academicYear.id)),
    { concurrency: 4 },
  );

  return makeTimetableImportPlan({
    dataSourceId: `webuntis:${appData.tenant.id}`,
    school: {
      externalId: appData.tenant.id,
      name: appData.tenant.displayName,
      loginName: appData.tenant.name,
    },
    academicYear,
    requestedRange: { start, end },
    requestedDates: dates,
    resources,
    responses,
  });
});

export interface CourseIdentityAuditRange {
  readonly schoolYear: string;
  readonly start: string;
  readonly end: string;
}

/** Fetches one or more timetable periods and audits identity evidence without persistence. */
export const fetchCourseIdentityAudit = Effect.fn("WebUntis.fetchCourseIdentityAudit")(function* (
  ranges: ReadonlyArray<CourseIdentityAuditRange>,
) {
  const plans = yield* Effect.forEach(
    ranges,
    (range) => fetchTimetableImportPlan(range.schoolYear, range.start, range.end),
    { concurrency: 2 },
  );
  const periods = yield* Effect.forEach(plans, (plan) =>
    projectTimetableOccurrences({
      dataSourceId: Importing.DataSourceId.make(plan.preview.dataSourceId),
      observations: plan.snapshots.flatMap((snapshot) => snapshot.observations),
    }).pipe(
      Effect.map(
        (occurrences) =>
          ({
            academicYear: plan.preview.academicYear,
            occurrences,
          }) satisfies CourseIdentityAuditPeriod,
      ),
    ),
  );
  const school = plans[0]?.preview.school;
  const profile = school === undefined ? undefined : findSchoolProfile(school);

  return makeCourseIdentityAudit({
    periods,
    lastingClassIdentity:
      profile === undefined
        ? undefined
        : ({ academicYearStart, shortName }) => {
            const resolution = profile.resolveClass({ academicYearStart, shortName });
            switch (resolution._tag) {
              case "ClassGroup":
                return `ClassGroup:${resolution.classGroupId}`;
              case "Cohort":
                return `CohortEntry:${resolution.cohortEntryAcademicYearStart}`;
              case "Collection":
                return undefined;
            }
          },
  });
});

export const layer = webUntisLayer;

export {
  InvalidTimetableOccurrence,
  projectTimetableOccurrences,
  type ProjectTimetableOccurrencesInput,
} from "./timetable-projection.ts";
export {
  makeCourseIdentityAudit,
  type CourseIdentityAuditInput,
  type CourseIdentityAuditPeriod,
} from "./course-identity-audit.ts";

export * as WebUntisTimetable from "./timetable.ts";
