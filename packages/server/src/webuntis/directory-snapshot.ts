import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { DisplayResource } from "webuntis-api";
import { hashSourceObservations } from "../importing/source-snapshot.ts";
import {
  collectDirectoryResources,
  type DirectoryInventory,
  type DirectoryPreview,
  fetchDirectoryInventory,
  summarizeDirectoryInventory,
} from "./directory-preview.ts";

const ResourceFields = {
  shortName: Schema.String,
  longName: Schema.String,
  displayName: Schema.String,
} as const;

const ExternalReference = Schema.Struct({ externalId: Schema.String, ...ResourceFields });

export const DirectoryObservation = Schema.TaggedUnion({
  School: {
    externalId: Schema.String,
    payload: Schema.Struct({
      name: Schema.String,
      loginName: Schema.String,
      hostName: Schema.NullOr(Schema.String),
    }),
  },
  AcademicYear: {
    externalId: Schema.String,
    payload: Schema.Struct({ name: Schema.String, start: Schema.String, end: Schema.String }),
  },
  Department: { externalId: Schema.String, payload: Schema.Struct(ResourceFields) },
  Building: { externalId: Schema.String, payload: Schema.Struct(ResourceFields) },
  Room: {
    externalId: Schema.String,
    payload: Schema.Struct({
      ...ResourceFields,
      capacity: Schema.Int,
      buildingExternalId: Schema.NullOr(Schema.String),
      departmentExternalId: Schema.NullOr(Schema.String),
    }),
  },
  ClassGroup: {
    externalId: Schema.String,
    payload: Schema.Struct({
      ...ResourceFields,
      academicYearExternalId: Schema.String,
      departmentExternalId: Schema.NullOr(Schema.String),
      classTeachers: Schema.Struct({
        firstExternalId: Schema.NullOr(Schema.String),
        secondExternalId: Schema.NullOr(Schema.String),
      }),
    }),
  },
  Teacher: {
    externalId: Schema.String,
    payload: Schema.Struct({
      ...ResourceFields,
      departments: Schema.Array(ExternalReference),
    }),
  },
  Student: {
    externalId: Schema.String,
    payload: Schema.Struct({
      ...ResourceFields,
      classes: Schema.Array(
        Schema.Struct({
          class: ExternalReference,
          start: Schema.String,
          end: Schema.String,
          departmentExternalId: Schema.NullOr(Schema.String),
        }),
      ),
    }),
  },
  Subject: {
    externalId: Schema.String,
    payload: Schema.Struct({
      ...ResourceFields,
      departments: Schema.Array(ExternalReference),
    }),
  },
  Holiday: {
    externalId: Schema.String,
    payload: Schema.Struct({
      name: Schema.String,
      start: Schema.String,
      end: Schema.String,
      bookable: Schema.Boolean,
    }),
  },
  BellPeriod: {
    externalId: Schema.String,
    payload: Schema.Struct({
      unitOfDay: Schema.Int,
      startTime: Schema.Int,
      endTime: Schema.Int,
    }),
  },
});
export type DirectoryObservation = typeof DirectoryObservation.Type;
const DirectoryObservations = Schema.Array(DirectoryObservation);

export interface DirectorySnapshot {
  readonly preview: DirectoryPreview;
  readonly contentHash: string;
  readonly observations: ReadonlyArray<DirectoryObservation>;
}

const resourceFields = (resource: DisplayResource) => ({
  shortName: resource.shortName,
  longName: resource.longName,
  displayName: resource.displayName,
});

const reference = (resource: DisplayResource) => ({
  externalId: String(resource.id),
  ...resourceFields(resource),
});

const byExternalId = <Value extends { readonly externalId: string }>(left: Value, right: Value) =>
  left.externalId < right.externalId ? -1 : left.externalId > right.externalId ? 1 : 0;

const sortedReferences = (resources: ReadonlyArray<DisplayResource>) =>
  resources.map(reference).sort(byExternalId);

const byObservationIdentity = (left: DirectoryObservation, right: DirectoryObservation) => {
  const kind = left._tag < right._tag ? -1 : left._tag > right._tag ? 1 : 0;
  return kind === 0 ? byExternalId(left, right) : kind;
};

const byClassMembership = (
  left: {
    readonly class: { readonly externalId: string };
    readonly start: string;
    readonly end: string;
  },
  right: {
    readonly class: { readonly externalId: string };
    readonly start: string;
    readonly end: string;
  },
) => {
  const classId = byExternalId(left.class, right.class);
  if (classId !== 0) return classId;
  const interval = `${left.start}\u0000${left.end}`;
  const otherInterval = `${right.start}\u0000${right.end}`;
  return interval < otherInterval ? -1 : interval > otherInterval ? 1 : 0;
};

/** The snapshot hash is a source revision over normalized, identity-sorted provider records. */
export const hashDirectoryObservations = (
  observations: ReadonlyArray<DirectoryObservation>,
): string => hashSourceObservations(observations);

/** Converts a decoded WebUntis response into stable records suitable for durable storage. */
export const makeDirectorySnapshot = (inventory: DirectoryInventory): DirectorySnapshot => {
  const preview = summarizeDirectoryInventory(inventory);
  const { appData, academicYear } = inventory;
  const {
    departments,
    buildings,
    rooms,
    classes,
    teachers,
    students,
    activities,
    holidays,
    bellPeriods,
  } = collectDirectoryResources(inventory);
  const academicYearExternalId = String(academicYear.id);

  const observations = [
    ...DirectoryObservations.make([
      DirectoryObservation.make({
        _tag: "School",
        externalId: appData.tenant.id,
        payload: {
          name: appData.tenant.displayName,
          loginName: appData.tenant.name,
          hostName: appData.tenant.wuHostName ?? null,
        },
      }),
      DirectoryObservation.make({
        _tag: "AcademicYear",
        externalId: academicYearExternalId,
        payload: {
          name: academicYear.name,
          start: academicYear.dateRange.start,
          end: academicYear.dateRange.end,
        },
      }),
      ...departments.resources.map((department) =>
        DirectoryObservation.make({
          _tag: "Department",
          externalId: String(department.id),
          payload: resourceFields(department),
        }),
      ),
      ...buildings.resources.map((building) =>
        DirectoryObservation.make({
          _tag: "Building",
          externalId: String(building.id),
          payload: resourceFields(building),
        }),
      ),
      ...rooms.map((item) =>
        DirectoryObservation.make({
          _tag: "Room",
          externalId: String(item.room.id),
          payload: {
            ...resourceFields(item.room),
            capacity: item.capacity,
            buildingExternalId: item.building === null ? null : String(item.building.id),
            departmentExternalId: item.department === null ? null : String(item.department.id),
          },
        }),
      ),
      ...classes.map((item) =>
        DirectoryObservation.make({
          _tag: "ClassGroup",
          externalId: String(item.class.id),
          payload: {
            ...resourceFields(item.class),
            academicYearExternalId,
            departmentExternalId: item.department === null ? null : String(item.department.id),
            classTeachers: {
              firstExternalId: item.classTeacher1 === null ? null : String(item.classTeacher1.id),
              secondExternalId: item.classTeacher2 === null ? null : String(item.classTeacher2.id),
            },
          },
        }),
      ),
      ...teachers.map((item) =>
        DirectoryObservation.make({
          _tag: "Teacher",
          externalId: String(item.teacher.id),
          payload: {
            ...resourceFields(item.teacher),
            departments: sortedReferences(item.departments),
          },
        }),
      ),
      ...students.map((item) =>
        DirectoryObservation.make({
          _tag: "Student",
          externalId: String(item.student.id),
          payload: {
            ...resourceFields(item.student),
            classes: item.classes
              .map((membership) => ({
                class: reference(membership.class),
                start: membership.dateRange.start,
                end: membership.dateRange.end,
                departmentExternalId:
                  membership.department === null ? null : String(membership.department.id),
              }))
              .sort(byClassMembership),
          },
        }),
      ),
      ...activities.map((item) =>
        DirectoryObservation.make({
          _tag: "Subject",
          externalId: String(item.subject.id),
          payload: {
            ...resourceFields(item.subject),
            departments: sortedReferences(item.departments),
          },
        }),
      ),
      ...holidays.map((holiday) =>
        DirectoryObservation.make({
          _tag: "Holiday",
          externalId: String(holiday.id),
          payload: {
            name: holiday.name,
            start: holiday.start,
            end: holiday.end,
            bookable: holiday.bookable,
          },
        }),
      ),
      ...bellPeriods.map((period) =>
        DirectoryObservation.make({
          _tag: "BellPeriod",
          externalId: String(period.unitOfDay),
          payload: period,
        }),
      ),
    ]),
  ].sort(byObservationIdentity);

  return {
    preview,
    observations,
    contentHash: hashDirectoryObservations(observations),
  };
};

/** Fetches one complete directory snapshot. It still performs no persistence. */
export const fetchDirectorySnapshot = Effect.fn("WebUntis.fetchDirectorySnapshot")(function* (
  requestedSchoolYear: string,
) {
  return makeDirectorySnapshot(yield* fetchDirectoryInventory(requestedSchoolYear));
});
