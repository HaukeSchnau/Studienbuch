import type { Schedule } from "@stu/core";
import * as EffectArray from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import {
  AppClient,
  SchoolyearsClient,
  TimetableClient,
  webUntisLayer,
  withSchoolYear,
  type Schoolyear,
  type TimetableEntries,
  type TimetableEntry,
  type TimetableEntryDay,
  type TimetableFilter,
} from "webuntis-api";
import { TimetableEntrySchema, TimetableStudentFilterItemSchema } from "webuntis-api/schemas";
import { hashSourceObservations, type SourceSnapshot } from "../importing/source-snapshot.ts";
import { SchoolYearUnavailable } from "./directory-preview.ts";
import type { WebUntisSchoolProfile } from "./school-profile.ts";
import {
  normalizeTimetableEntry,
  requestedTimetableDates,
  timetableEntryExternalId,
  timetableResourceBatchSize,
  timetableResourceReference,
  type TimetableDiagnostic,
  type TimetableDiagnosticCode,
} from "./timetable.ts";

type StudentFilterItem = TimetableFilter["students"][number];
type TimetableEntryLocation = "Back" | "Day" | "Grid";

export const StudentTimetableObservation = Schema.TaggedStruct("TimetableOccurrence", {
  externalId: Schema.String,
  payload: Schema.Struct({
    academicYearExternalId: Schema.String,
    date: Schema.String,
    resource: Schema.Struct({
      externalId: Schema.String,
      shortName: Schema.String,
      longName: Schema.String,
      displayName: Schema.String,
    }),
    student: TimetableStudentFilterItemSchema,
    dayStatus: Schema.String,
    location: Schema.Literals(["Back", "Day", "Grid"]),
    entry: TimetableEntrySchema,
  }),
});
export type StudentTimetableObservation = typeof StudentTimetableObservation.Type;

export interface StudentTimetableInventory {
  readonly dataSourceId: string;
  readonly school: {
    readonly externalId: string;
    readonly name: string;
    readonly loginName: string;
  };
  readonly academicYear: Schoolyear;
  readonly requestedRange: { readonly start: string; readonly end: string };
  readonly requestedDates: ReadonlyArray<string>;
  readonly students: TimetableFilter["students"];
  readonly responses: ReadonlyArray<TimetableEntries>;
}

export interface StudentTimetableDayPreview {
  readonly date: string;
  readonly completeness: "Complete" | "Partial";
  readonly expectedStudentRows: number;
  readonly returnedStudentRows: number;
  readonly occurrenceViews: number;
  readonly diagnostics: ReadonlyArray<TimetableDiagnostic>;
}

export interface StudentTimetablePreview {
  readonly dataSourceId: string;
  readonly provider: "WebUntis";
  readonly school: StudentTimetableInventory["school"];
  readonly academicYear: {
    readonly externalId: string;
    readonly name: string;
    readonly start: string;
    readonly end: string;
  };
  readonly requestedRange: { readonly start: string; readonly end: string };
  readonly studentCount: number;
  readonly responseCount: number;
  readonly responseErrorCount: number;
  readonly completeDays: number;
  readonly partialDays: number;
  readonly wouldImport: { readonly privateOccurrenceViews: number };
  readonly days: ReadonlyArray<StudentTimetableDayPreview>;
  readonly diagnostics: ReadonlyArray<TimetableDiagnostic>;
}

export interface StudentTimetableImportPlan {
  readonly preview: StudentTimetablePreview;
  readonly snapshots: ReadonlyArray<SourceSnapshot<StudentTimetableObservation>>;
}

interface DayState {
  readonly date: string;
  readonly resourceRowCounts: Map<string, number>;
  readonly observations: Map<string, StudentTimetableObservation>;
  readonly conflictingIdentities: Set<string>;
  readonly diagnostics: Map<TimetableDiagnosticCode, number>;
}

const incrementDiagnostic = (
  diagnostics: Map<TimetableDiagnosticCode, number>,
  code: TimetableDiagnosticCode,
  amount = 1,
) => {
  if (amount > 0) diagnostics.set(code, (diagnostics.get(code) ?? 0) + amount);
};

const diagnosticRows = (
  diagnostics: Map<TimetableDiagnosticCode, number>,
  date?: string,
): ReadonlyArray<TimetableDiagnostic> =>
  [...diagnostics.entries()]
    .sort(([left], [right]) => Order.String(left, right))
    .map(([code, count]) => ({
      severity: code === "UnexpectedResourceDay" ? "Warning" : "Error",
      code,
      count,
      date,
    }));

const studentKey = (studentExternalId: number | string) => `STUDENT:${studentExternalId}`;

const isStudentTimetableDay = (
  day: TimetableEntryDay,
): day is TimetableEntryDay & { readonly resourceType: "STUDENT" } =>
  day.resourceType === "STUDENT";

const emptyDayState = (date: string): DayState => ({
  date,
  resourceRowCounts: new Map(),
  observations: new Map(),
  conflictingIdentities: new Set(),
  diagnostics: new Map(),
});

const addEntries = (
  state: DayState,
  academicYearExternalId: string,
  day: TimetableEntryDay & { readonly resourceType: "STUDENT" },
  student: StudentFilterItem,
  location: TimetableEntryLocation,
  entries: ReadonlyArray<TimetableEntry>,
) => {
  for (const rawEntry of entries) {
    if (rawEntry.ids.length === 0) {
      incrementDiagnostic(state.diagnostics, "EntryWithoutId");
      continue;
    }
    const entry = normalizeTimetableEntry(rawEntry);
    const externalId = timetableEntryExternalId(day, entry);
    if (state.conflictingIdentities.has(externalId)) continue;
    const observation = StudentTimetableObservation.make({
      _tag: "TimetableOccurrence",
      externalId,
      payload: {
        academicYearExternalId,
        date: day.date,
        resource: timetableResourceReference(day.resource),
        student,
        dayStatus: day.status,
        location,
        entry,
      },
    });
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

/** Builds private daily snapshots. The preview contains counts and provider IDs, never student names. */
export const makeStudentTimetableImportPlan = (
  inventory: StudentTimetableInventory,
): StudentTimetableImportPlan => {
  const academicYearExternalId = String(inventory.academicYear.id);
  const studentsById = new Map(inventory.students.map((item) => [item.student.id, item]));
  const expectedStudentKeys = new Set(
    inventory.students.map((item) => studentKey(item.student.id)),
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
      const student = studentsById.get(day.resource.id);
      if (
        state === undefined ||
        !isStudentTimetableDay(day) ||
        student === undefined ||
        !expectedStudentKeys.has(studentKey(day.resource.id))
      ) {
        incrementDiagnostic(overallDiagnostics, "UnexpectedResourceDay");
        continue;
      }

      const key = studentKey(day.resource.id);
      state.resourceRowCounts.set(key, (state.resourceRowCounts.get(key) ?? 0) + 1);
      if (day.status === "NOT_ALLOWED" || day.status === "NOT_ALLOWED_FOR_RESOURCE") {
        incrementDiagnostic(state.diagnostics, "NotAllowedResourceDay");
      }
      addEntries(state, academicYearExternalId, day, student, "Day", day.dayEntries);
      addEntries(state, academicYearExternalId, day, student, "Grid", day.gridEntries);
      addEntries(state, academicYearExternalId, day, student, "Back", day.backEntries);
    }
  }

  const snapshots: Array<SourceSnapshot<StudentTimetableObservation>> = [];
  const dayPreviews: Array<StudentTimetableDayPreview> = [];
  for (const state of days.values()) {
    incrementDiagnostic(
      state.diagnostics,
      "MissingResourceDay",
      [...expectedStudentKeys].filter((key) => !state.resourceRowCounts.has(key)).length,
    );
    incrementDiagnostic(
      state.diagnostics,
      "DuplicateResourceDay",
      [...state.resourceRowCounts.values()].filter((count) => count > 1).length,
    );
    incrementDiagnostic(state.diagnostics, "ResponseError", responseErrorCount);

    const observations = [...state.observations.values()].sort((left, right) =>
      Order.String(left.externalId, right.externalId),
    );
    const completeness = state.diagnostics.size === 0 ? "Complete" : "Partial";
    const diagnostics = diagnosticRows(state.diagnostics, state.date);
    const counts = {
      expectedStudentRows: expectedStudentKeys.size,
      returnedStudentRows: state.resourceRowCounts.size,
      privateOccurrenceViews: observations.length,
    } as const;
    snapshots.push({
      provider: "WebUntis",
      dataSourceId: inventory.dataSourceId,
      dataset: "course-rosters",
      scope: `academic-year:${academicYearExternalId}/resource-type:STUDENT/date:${state.date}`,
      contentHash: hashSourceObservations(observations),
      completeness,
      observations,
      counts,
      diagnostics,
    });
    dayPreviews.push({
      date: state.date,
      completeness,
      expectedStudentRows: expectedStudentKeys.size,
      returnedStudentRows: state.resourceRowCounts.size,
      occurrenceViews: observations.length,
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
      studentCount: inventory.students.length,
      responseCount: inventory.responses.length,
      responseErrorCount,
      completeDays: dayPreviews.filter((day) => day.completeness === "Complete").length,
      partialDays: dayPreviews.filter((day) => day.completeness === "Partial").length,
      wouldImport: {
        privateOccurrenceViews: dayPreviews.reduce((count, day) => count + day.occurrenceViews, 0),
      },
      days: dayPreviews,
      diagnostics: diagnosticRows(overallDiagnostics),
    },
    snapshots,
  };
};

const isEffectiveOn = (
  date: string,
  interval: { readonly dateRange: { readonly start: string; readonly end: string } },
) => interval.dateRange.start <= date && date <= interval.dateRange.end;

const schoolGroupKeys = (
  observation: StudentTimetableObservation,
  academicYearStart: number,
  profile: WebUntisSchoolProfile | undefined,
) => {
  if (profile === undefined) return [];
  return observation.payload.student.classes
    .filter((item) => isEffectiveOn(observation.payload.date, item))
    .flatMap((item) => {
      const resolution = profile.resolveClass({
        academicYearStart,
        shortName: item.class.shortName,
      });
      switch (resolution._tag) {
        case "ClassGroup":
          return [`ClassGroup:${resolution.classGroupId}`];
        case "Cohort":
          return [`CohortEntry:${resolution.cohortEntryAcademicYearStart}`];
        case "Collection":
          return [];
      }
    })
    .sort(Order.String);
};

const currentEntryResources = (entry: TimetableEntry) =>
  [entry.position1, entry.position2, entry.position3, entry.position4].flatMap((positions) =>
    (positions ?? []).flatMap((position) => (position.current === null ? [] : [position.current])),
  );

const normalizeCode = (value: string) => value.normalize("NFKC").trim().toUpperCase();

const uniqueSorted = (values: Iterable<string>) => [...new Set(values)].sort(Order.String);

export const CourseRosterMember = Schema.Struct({
  studentExternalId: Schema.String,
  classExternalIds: Schema.Array(Schema.String),
  schoolGroupKeys: Schema.Array(Schema.String),
});
export interface CourseRosterMember extends Schema.Schema.Type<typeof CourseRosterMember> {}

export const CourseRosterObservation = Schema.Struct({
  id: Schema.String,
  academicYearExternalId: Schema.String,
  date: Schema.String,
  providerEntryIds: Schema.NonEmptyArray(Schema.String),
  sourceExternalIds: Schema.NonEmptyArray(Schema.String),
  timeRanges: Schema.NonEmptyArray(Schema.String),
  courseCodes: Schema.Array(Schema.String),
  activityExternalIds: Schema.Array(Schema.String),
  teacherExternalIds: Schema.Array(Schema.String),
  classExternalIds: Schema.Array(Schema.String),
  members: Schema.NonEmptyArray(CourseRosterMember),
  regularTeaching: Schema.Boolean,
});
export interface CourseRosterObservation extends Schema.Schema.Type<
  typeof CourseRosterObservation
> {}

export interface ProjectCourseRosterObservationsInput {
  readonly observations: ReadonlyArray<StudentTimetableObservation>;
  readonly academicYearStart: number;
  readonly profile?: WebUntisSchoolProfile | undefined;
  readonly occurrences?: ReadonlyArray<Schedule.ProviderBackedOccurrence> | undefined;
}

export const courseRosterOccurrenceKey = (date: string, providerEntryIds: ReadonlyArray<string>) =>
  `${date}\u0000${providerEntryIds.join(",")}`;

const occurrenceFacts = (occurrences: ReadonlyArray<Schedule.ProviderBackedOccurrence>) =>
  new Map(
    occurrences.map((occurrence) => {
      const resources = (type: "CLASS" | "SUBJECT" | "TEACHER") =>
        occurrence.claims.flatMap((claim) => {
          const source = claim.viewedResource.source;
          return claim.viewedResource.type === type && source !== undefined
            ? [{ externalId: source.externalId, shortName: claim.viewedResource.shortName }]
            : [];
        });
      return [
        courseRosterOccurrenceKey(PlainDate.toString(occurrence.date), occurrence.providerEntryIds),
        {
          activities: resources("SUBJECT"),
          teacherExternalIds: resources("TEACHER").map((item) => item.externalId),
          classExternalIds: resources("CLASS").map((item) => item.externalId),
        },
      ] as const;
    }),
  );

/** Removes student names while retaining the private identities needed for course reconciliation. */
export const projectCourseRosterObservations = (
  input: ProjectCourseRosterObservationsInput,
): ReadonlyArray<CourseRosterObservation> => {
  const providerOccurrences = occurrenceFacts(input.occurrences ?? []);
  const grouped = new Map<string, Array<StudentTimetableObservation>>();
  for (const observation of input.observations) {
    const ids = observation.payload.entry.ids.map(String).sort(Order.String);
    const key = courseRosterOccurrenceKey(observation.payload.date, ids);
    const group = grouped.get(key) ?? [];
    group.push(observation);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .flatMap(([key, group]) => {
      const first = group[0];
      if (first === undefined) return [];
      const providerEntryIds = first.payload.entry.ids.map(String).sort(Order.String);
      const firstProviderEntryId = providerEntryIds[0];
      if (firstProviderEntryId === undefined) return [];
      const facts = providerOccurrences.get(key);
      const membersByStudent = new Map<string, CourseRosterMember>();
      for (const observation of group) {
        const studentExternalId = String(observation.payload.student.student.id);
        membersByStudent.set(
          studentExternalId,
          CourseRosterMember.make({
            studentExternalId,
            classExternalIds: uniqueSorted(
              observation.payload.student.classes
                .filter((item) => isEffectiveOn(observation.payload.date, item))
                .map((item) => String(item.class.id)),
            ),
            schoolGroupKeys: uniqueSorted(
              schoolGroupKeys(observation, input.academicYearStart, input.profile),
            ),
          }),
        );
      }
      const members = [...membersByStudent.values()].sort((left, right) =>
        Order.String(left.studentExternalId, right.studentExternalId),
      );
      const firstMember = members[0];
      if (firstMember === undefined) return [];
      const dayStatuses = uniqueSorted(group.map((item) => item.payload.dayStatus));
      const entryTypes = uniqueSorted(group.map((item) => item.payload.entry.type));
      const entryStatuses = uniqueSorted(group.map((item) => item.payload.entry.status));
      const timeRanges = uniqueSorted(
        group.map(
          (item) => `${item.payload.entry.duration.start}/${item.payload.entry.duration.end}`,
        ),
      );
      const firstTimeRange = timeRanges[0];
      if (firstTimeRange === undefined) return [];
      const positionCodes = group.flatMap((item) =>
        currentEntryResources(item.payload.entry)
          .filter((resource) => resource.type === "SUBJECT")
          .map((resource) => normalizeCode(resource.shortName)),
      );
      const activityCodes =
        facts?.activities.map((activity) => normalizeCode(activity.shortName)) ?? [];
      const sourceExternalIds = group.map((item) => item.externalId).sort(Order.String);
      const firstSourceExternalId = sourceExternalIds[0];
      if (firstSourceExternalId === undefined) return [];

      return [
        CourseRosterObservation.make({
          id: `academic-year:${first.payload.academicYearExternalId}/date:${first.payload.date}/entries:${providerEntryIds.join(",")}`,
          academicYearExternalId: first.payload.academicYearExternalId,
          date: first.payload.date,
          providerEntryIds: [firstProviderEntryId, ...providerEntryIds.slice(1)],
          sourceExternalIds: [firstSourceExternalId, ...sourceExternalIds.slice(1)],
          timeRanges: [firstTimeRange, ...timeRanges.slice(1)],
          courseCodes: uniqueSorted([...positionCodes, ...activityCodes]),
          activityExternalIds: uniqueSorted(
            facts?.activities.map((activity) => activity.externalId) ?? [],
          ),
          teacherExternalIds: uniqueSorted(facts?.teacherExternalIds ?? []),
          classExternalIds: uniqueSorted([
            ...(facts?.classExternalIds ?? []),
            ...members.flatMap((member) => member.classExternalIds),
          ]),
          members: [firstMember, ...members.slice(1)],
          regularTeaching:
            dayStatuses.length === 1 &&
            dayStatuses[0] === "REGULAR" &&
            entryTypes.length === 1 &&
            entryTypes[0] === "NORMAL_TEACHING_PERIOD" &&
            entryStatuses.length === 1 &&
            entryStatuses[0] === "REGULAR" &&
            timeRanges.length === 1,
        }),
      ];
    })
    .sort((left, right) => Order.String(left.id, right.id));
};

/** Fetches the private student view in bounded batches and performs no persistence. */
export const fetchStudentTimetableImportPlan = Effect.fn(
  "WebUntis.fetchStudentTimetableImportPlan",
)(function* (requestedSchoolYear: string, start: string, end: string) {
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
  const requestedDates = yield* requestedTimetableDates(start, end, academicYear);
  const filter = yield* timetable
    .getFilter({ start, end, resourceType: "STUDENT", timetableType: "STANDARD" })
    .pipe(withSchoolYear(academicYear.id));
  const students = [...filter.students].sort((left, right) => left.student.id - right.student.id);
  const batches = EffectArray.chunksOf(
    students.map((item) => item.student.id),
    timetableResourceBatchSize,
  );
  const responses = yield* Effect.forEach(
    batches,
    (resources) =>
      timetable
        .getEntries({
          start,
          end,
          resourceType: "STUDENT",
          resources,
          timetableType: "STANDARD",
        })
        .pipe(withSchoolYear(academicYear.id)),
    { concurrency: 3 },
  );

  return makeStudentTimetableImportPlan({
    dataSourceId: `webuntis:${appData.tenant.id}`,
    school: {
      externalId: appData.tenant.id,
      name: appData.tenant.displayName,
      loginName: appData.tenant.name,
    },
    academicYear,
    requestedRange: { start, end },
    requestedDates,
    students,
    responses,
  });
});

export const layer = webUntisLayer;
