import { Importing, Organization } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import {
  DirectoryEntity,
  ProviderActivity,
  directoryEntityKey,
} from "../organization/directory-entity.ts";
import type { DirectoryObservation } from "./directory-snapshot.ts";
import { findSchoolProfile, type WebUntisSchoolProfile } from "./school-profile.ts";

export interface DirectoryProjectionSourceRecord {
  readonly scope: string;
  readonly sourceRecordVersionId: string;
  readonly observation: DirectoryObservation;
}

export interface ProjectDirectoryInput {
  readonly dataSourceId: string;
  readonly records: ReadonlyArray<DirectoryProjectionSourceRecord>;
}

export class DirectoryProfileUnavailable extends Schema.TaggedError<DirectoryProfileUnavailable>()(
  "WebUntis.DirectoryProfileUnavailable",
  { externalId: Schema.String, loginName: Schema.String },
) {}

export class DirectorySchoolUnavailable extends Schema.TaggedError<DirectorySchoolUnavailable>()(
  "WebUntis.DirectorySchoolUnavailable",
  { dataSourceId: Schema.String },
) {}

export class DirectoryAcademicYearUnavailable extends Schema.TaggedError<DirectoryAcademicYearUnavailable>()(
  "WebUntis.DirectoryAcademicYearUnavailable",
  { scope: Schema.String, externalId: Schema.String },
) {}

export class InvalidDirectoryProjection extends Schema.TaggedError<InvalidDirectoryProjection>()(
  "WebUntis.InvalidDirectoryProjection",
  {
    entityKind: Schema.String,
    externalId: Schema.String,
    reason: Schema.String,
  },
) {}

export interface DirectoryProjectionDiagnostic {
  readonly code: "UnresolvedCohortName" | "CollectionResource" | "UnresolvedActivity";
  readonly count: number;
}

export interface DirectoryProjection {
  readonly dataSourceId: Importing.DataSourceId;
  readonly schoolId: Organization.SchoolId;
  readonly entities: ReadonlyArray<DirectoryEntity>;
  readonly entitySources: ReadonlyArray<{
    readonly entityKey: string;
    readonly sourceRecordVersionIds: ReadonlyArray<string>;
  }>;
  readonly entityLinks: ReadonlyArray<Importing.EntityLink>;
  readonly diagnostics: ReadonlyArray<DirectoryProjectionDiagnostic>;
}

type RecordWithTag<Tag extends DirectoryObservation["_tag"]> = DirectoryProjectionSourceRecord & {
  readonly observation: Extract<DirectoryObservation, { readonly _tag: Tag }>;
};

const recordsWithTag = <Tag extends DirectoryObservation["_tag"]>(
  records: ReadonlyArray<DirectoryProjectionSourceRecord>,
  tag: Tag,
): Array<RecordWithTag<Tag>> =>
  records.filter((record): record is RecordWithTag<Tag> => record.observation._tag === tag);

const projectedKey = (entityKind: DirectoryEntity["_tag"], entityId: string) =>
  `${entityKind}\u0000${entityId}`;

const sourceIdentity = (dataSourceId: Importing.DataSourceId, observation: DirectoryObservation) =>
  Importing.SourceIdentity.make({
    dataSourceId,
    entityKind: observation._tag,
    externalId: Importing.ExternalId.make(observation.externalId),
  });

const linkKey = (link: Importing.EntityLink) =>
  `${link._tag}\u0000${link.source.entityKind}\u0000${link.source.externalId}`;

const preferredName = (value: {
  readonly shortName: string;
  readonly longName: string;
  readonly displayName: string;
}) =>
  [value.displayName, value.longName, value.shortName].find(
    (candidate) => candidate.trim() !== "",
  ) ?? "Unnamed";

const optionalCode = (value: string) => (value.trim() === "" ? undefined : value);

const groupByExternalId = <Tag extends DirectoryObservation["_tag"]>(
  records: ReadonlyArray<RecordWithTag<Tag>>,
) => {
  const groups = new Map<string, Array<RecordWithTag<Tag>>>();
  for (const record of records) {
    const group = groups.get(record.observation.externalId) ?? [];
    group.push(record);
    groups.set(record.observation.externalId, group);
  }
  return groups;
};

const minimumDate = (values: ReadonlyArray<string>) => [...values].sort()[0];
const maximumDate = (values: ReadonlyArray<string>) => [...values].sort().at(-1);

const domainId = {
  academicYear: (profile: WebUntisSchoolProfile, externalId: string) =>
    Organization.AcademicYearId.make(profile.entityId("academic-year", externalId)),
  department: (profile: WebUntisSchoolProfile, externalId: string) =>
    Organization.DepartmentId.make(profile.entityId("department", externalId)),
  building: (profile: WebUntisSchoolProfile, externalId: string) =>
    Organization.BuildingId.make(profile.entityId("building", externalId)),
  room: (profile: WebUntisSchoolProfile, externalId: string) =>
    Organization.RoomId.make(profile.entityId("room", externalId)),
  person: (profile: WebUntisSchoolProfile, entityKind: "Teacher" | "Student", externalId: string) =>
    Organization.PersonId.make(profile.entityId(entityKind.toLowerCase(), externalId)),
  membership: (
    profile: WebUntisSchoolProfile,
    entityKind: "Teacher" | "Student",
    externalId: string,
  ) =>
    Organization.SchoolMembershipId.make(
      profile.entityId(`${entityKind.toLowerCase()}-membership`, externalId),
    ),
};

/** Projects all current directory scopes for one data source into one canonical school directory. */
export const projectDirectory = Effect.fn("WebUntis.projectDirectory")(function* (
  input: ProjectDirectoryInput,
) {
  const dataSourceId = yield* Schema.decodeEffect(Importing.DataSourceId)(input.dataSourceId);
  const academicYearRecords = recordsWithTag(input.records, "AcademicYear");
  const academicYearStartByScope = new Map(
    academicYearRecords.map((record) => [record.scope, record.observation.payload.start]),
  );
  const schoolRecords = recordsWithTag(input.records, "School");
  const schoolRecord = [...schoolRecords]
    .sort((left, right) =>
      (academicYearStartByScope.get(left.scope) ?? "").localeCompare(
        academicYearStartByScope.get(right.scope) ?? "",
      ),
    )
    .at(-1);
  if (schoolRecord === undefined) {
    return yield* DirectorySchoolUnavailable.make({ dataSourceId: input.dataSourceId });
  }
  const schoolSource = schoolRecord.observation;
  const profile = findSchoolProfile({
    externalId: schoolSource.externalId,
    loginName: schoolSource.payload.loginName,
    name: schoolSource.payload.name,
  });
  if (profile === undefined) {
    return yield* DirectoryProfileUnavailable.make({
      externalId: schoolSource.externalId,
      loginName: schoolSource.payload.loginName,
    });
  }

  const invalid = (record: DirectoryProjectionSourceRecord) =>
    Effect.mapError((error: Schema.SchemaError) =>
      InvalidDirectoryProjection.make({
        entityKind: record.observation._tag,
        externalId: record.observation.externalId,
        reason: String(error),
      }),
    );
  const school = yield* Schema.decodeEffect(Organization.School)({
    id: profile.schoolId,
    name: schoolSource.payload.name,
  }).pipe(invalid(schoolRecord));

  const academicYears: Array<Organization.AcademicYear> = [];
  const academicYearByExternalId = new Map<string, Organization.AcademicYear>();
  const academicYearByScope = new Map<string, Organization.AcademicYear>();
  for (const record of academicYearRecords) {
    const value = yield* Schema.decodeEffect(Organization.AcademicYear)({
      id: domainId.academicYear(profile, record.observation.externalId),
      schoolId: school.id,
      name: record.observation.payload.name,
      interval: {
        start: record.observation.payload.start,
        end: record.observation.payload.end,
      },
    }).pipe(invalid(record));
    academicYears.push(value);
    academicYearByExternalId.set(record.observation.externalId, value);
    academicYearByScope.set(record.scope, value);
  }

  const yearFor = (record: DirectoryProjectionSourceRecord) =>
    academicYearByScope.get(record.scope);
  const latest = <Tag extends DirectoryObservation["_tag"]>(group: Array<RecordWithTag<Tag>>) =>
    [...group]
      .sort(
        (left, right) =>
          (yearFor(left)?.interval.start.year ?? 0) - (yearFor(right)?.interval.start.year ?? 0),
      )
      .at(-1);

  const sourceVersions = new Map<string, Set<string>>();
  const addSources = (
    entityKind: DirectoryEntity["_tag"],
    entityId: string,
    records: ReadonlyArray<DirectoryProjectionSourceRecord>,
  ) => {
    const key = projectedKey(entityKind, entityId);
    const versions = sourceVersions.get(key) ?? new Set<string>();
    for (const record of records) versions.add(record.sourceRecordVersionId);
    sourceVersions.set(key, versions);
  };
  const links = new Map<string, Importing.EntityLink>();
  const addLink = (link: Importing.EntityLink) => links.set(linkKey(link), link);

  addSources("School", school.id, schoolRecords);
  for (const record of schoolRecords) {
    addLink(
      Importing.EntityLink.cases.School.make({
        source: sourceIdentity(dataSourceId, record.observation),
        schoolId: school.id,
      }),
    );
  }
  for (const record of academicYearRecords) {
    const value = academicYearByExternalId.get(record.observation.externalId);
    if (value === undefined) continue;
    addSources("AcademicYear", value.id, [record]);
    addLink(
      Importing.EntityLink.cases.AcademicYear.make({
        source: sourceIdentity(dataSourceId, record.observation),
        academicYearId: value.id,
      }),
    );
  }

  const departments: Array<Organization.Department> = [];
  for (const [externalId, group] of groupByExternalId(
    recordsWithTag(input.records, "Department"),
  )) {
    const record = latest(group);
    if (record === undefined) continue;
    const value = yield* Schema.decodeEffect(Organization.Department)({
      id: domainId.department(profile, externalId),
      schoolId: school.id,
      name: preferredName(record.observation.payload),
      code: optionalCode(record.observation.payload.shortName),
    }).pipe(invalid(record));
    departments.push(value);
    addSources("Department", value.id, group);
    addLink(
      Importing.EntityLink.cases.Department.make({
        source: sourceIdentity(dataSourceId, record.observation),
        departmentId: value.id,
      }),
    );
  }

  const buildings: Array<Organization.Building> = [];
  for (const [externalId, group] of groupByExternalId(recordsWithTag(input.records, "Building"))) {
    const record = latest(group);
    if (record === undefined) continue;
    const value = yield* Schema.decodeEffect(Organization.Building)({
      id: domainId.building(profile, externalId),
      schoolId: school.id,
      name: preferredName(record.observation.payload),
      code: optionalCode(record.observation.payload.shortName),
    }).pipe(invalid(record));
    buildings.push(value);
    addSources("Building", value.id, group);
    addLink(
      Importing.EntityLink.cases.Building.make({
        source: sourceIdentity(dataSourceId, record.observation),
        buildingId: value.id,
      }),
    );
  }

  const rooms: Array<Organization.Room> = [];
  for (const [externalId, group] of groupByExternalId(recordsWithTag(input.records, "Room"))) {
    const record = latest(group);
    if (record === undefined) continue;
    const payload = record.observation.payload;
    const value = yield* Schema.decodeEffect(Organization.Room)({
      id: domainId.room(profile, externalId),
      schoolId: school.id,
      name: preferredName(payload),
      code: optionalCode(payload.shortName),
      capacity: payload.capacity,
      buildingId:
        payload.buildingExternalId === null
          ? undefined
          : domainId.building(profile, payload.buildingExternalId),
      departmentId:
        payload.departmentExternalId === null
          ? undefined
          : domainId.department(profile, payload.departmentExternalId),
    }).pipe(invalid(record));
    rooms.push(value);
    addSources("Room", value.id, group);
    addLink(
      Importing.EntityLink.cases.Room.make({
        source: sourceIdentity(dataSourceId, record.observation),
        roomId: value.id,
      }),
    );
  }

  const cohorts = new Map<Organization.CohortId, Organization.Cohort>();
  const classGroups = new Map<Organization.ClassGroupId, Organization.ClassGroup>();
  const classGroupAcademicYears: Array<Organization.ClassGroupAcademicYear> = [];
  const classResolution = new Map<string, ReturnType<WebUntisSchoolProfile["resolveClass"]>>();
  const classRecords = recordsWithTag(input.records, "ClassGroup");
  const unresolvedCohortEntries = new Set<number>();
  let collectionResources = 0;
  for (const record of classRecords) {
    const academicYear = academicYearByExternalId.get(
      record.observation.payload.academicYearExternalId,
    );
    if (academicYear === undefined) {
      return yield* DirectoryAcademicYearUnavailable.make({
        scope: record.scope,
        externalId: record.observation.payload.academicYearExternalId,
      });
    }
    const resolution = profile.resolveClass({
      academicYearStart: academicYear.interval.start.year,
      shortName: record.observation.payload.shortName,
    });
    classResolution.set(`${record.scope}\u0000${record.observation.externalId}`, resolution);
    if (resolution._tag === "Collection") {
      collectionResources += 1;
      continue;
    }
    if (resolution.cohort === undefined) {
      unresolvedCohortEntries.add(resolution.cohortEntryAcademicYearStart);
    }
    if (resolution.cohort !== undefined) {
      cohorts.set(resolution.cohort.id, resolution.cohort);
      addSources("Cohort", resolution.cohort.id, [record]);
    }
    if (resolution._tag === "Cohort") {
      if (resolution.cohort !== undefined) {
        addLink(
          Importing.EntityLink.cases.Cohort.make({
            source: sourceIdentity(dataSourceId, record.observation),
            cohortId: resolution.cohort.id,
          }),
        );
      }
      continue;
    }
    const group = yield* Schema.decodeEffect(Organization.ClassGroup)({
      id: resolution.classGroupId,
      schoolId: school.id,
      cohortId: resolution.cohort?.id,
    }).pipe(invalid(record));
    classGroups.set(group.id, group);
    addSources("ClassGroup", group.id, [record]);
    addLink(
      Importing.EntityLink.cases.ClassGroup.make({
        source: sourceIdentity(dataSourceId, record.observation),
        classGroupId: group.id,
      }),
    );
    const placement = yield* Schema.decodeEffect(Organization.ClassGroupAcademicYear)({
      classGroupId: group.id,
      academicYearId: academicYear.id,
      name: record.observation.payload.shortName,
      gradeLevel: resolution.gradeLevel,
      departmentId:
        record.observation.payload.departmentExternalId === null
          ? undefined
          : domainId.department(profile, record.observation.payload.departmentExternalId),
    }).pipe(invalid(record));
    classGroupAcademicYears.push(placement);
    addSources("ClassGroupAcademicYear", `${placement.classGroupId}/${placement.academicYearId}`, [
      record,
    ]);
  }

  const people: Array<Organization.Person> = [];
  const memberships: Array<Organization.SchoolMembership> = [];
  const students: Array<Organization.StudentMembership> = [];
  const studentClassAssignments: Array<Organization.StudentClassAssignment> = [];
  const classTeacherAssignments: Array<Organization.ClassTeacherAssignment> = [];
  const departmentAssignments: Array<Organization.DepartmentAssignment> = [];

  const peopleFor = Effect.fnUntraced(function* (
    entityKind: "Teacher" | "Student",
    role: "Teacher" | "Student",
  ) {
    const groups = groupByExternalId(recordsWithTag(input.records, entityKind));
    for (const [externalId, group] of groups) {
      const record = latest(group);
      if (record === undefined) continue;
      const personId = domainId.person(profile, entityKind, externalId);
      const membershipId = domainId.membership(profile, entityKind, externalId);
      const person = yield* Schema.decodeEffect(Organization.Person)({
        id: personId,
        name: {
          displayName: preferredName(record.observation.payload),
          givenNames: [],
        },
      }).pipe(invalid(record));
      const coverage = group.flatMap((item) => {
        const academicYear = yearFor(item);
        return academicYear === undefined
          ? []
          : [
              PlainDate.toString(academicYear.interval.start),
              PlainDate.toString(academicYear.interval.end),
            ];
      });
      const start = minimumDate(coverage);
      const end = maximumDate(coverage);
      if (start === undefined || end === undefined) {
        return yield* DirectoryAcademicYearUnavailable.make({
          scope: record.scope,
          externalId: record.observation.externalId,
        });
      }
      const membership = yield* Schema.decodeEffect(Organization.SchoolMembership)({
        id: membershipId,
        schoolId: school.id,
        personId,
        roles: [role],
        effective: { start, end },
      }).pipe(invalid(record));
      people.push(person);
      memberships.push(membership);
      addSources("Person", person.id, group);
      addSources("SchoolMembership", membership.id, group);
      for (const sourceRecord of group) {
        const source = sourceIdentity(dataSourceId, sourceRecord.observation);
        addLink(Importing.EntityLink.cases.Person.make({ source, personId: person.id }));
        addLink(
          Importing.EntityLink.cases.SchoolMembership.make({
            source,
            schoolMembershipId: membership.id,
          }),
        );
      }

      if (entityKind === "Teacher") {
        for (const sourceRecord of group) {
          if (sourceRecord.observation._tag !== "Teacher") continue;
          const academicYear = yearFor(sourceRecord);
          if (academicYear === undefined) continue;
          for (const department of sourceRecord.observation.payload.departments) {
            const assignment = Organization.DepartmentAssignment.make({
              schoolMembershipId: membership.id,
              departmentId: domainId.department(profile, department.externalId),
              academicYearId: academicYear.id,
            });
            departmentAssignments.push(assignment);
            addSources(
              "DepartmentAssignment",
              `${assignment.schoolMembershipId}/${assignment.departmentId}/${assignment.academicYearId}`,
              [sourceRecord],
            );
          }
        }
        continue;
      }

      const candidateCohorts = new Set<Organization.CohortId>();
      for (const sourceRecord of group) {
        if (sourceRecord.observation._tag !== "Student") continue;
        for (const classMembership of sourceRecord.observation.payload.classes) {
          const resolution = classResolution.get(
            `${sourceRecord.scope}\u0000${classMembership.class.externalId}`,
          );
          if (resolution?._tag !== "ClassGroup") continue;
          if (resolution.cohort !== undefined) candidateCohorts.add(resolution.cohort.id);
          const assignment = yield* Schema.decodeEffect(Organization.StudentClassAssignment)({
            studentMembershipId: membership.id,
            classGroupId: resolution.classGroupId,
            effective: { start: classMembership.start, end: classMembership.end },
          }).pipe(invalid(sourceRecord));
          studentClassAssignments.push(assignment);
          addSources(
            "StudentClassAssignment",
            `${assignment.studentMembershipId}/${assignment.classGroupId}/${classMembership.start}/${classMembership.end}`,
            [sourceRecord],
          );
        }
      }
      const [cohortId] = candidateCohorts.size === 1 ? [...candidateCohorts] : [];
      const student = Organization.StudentMembership.make({ membershipId, cohortId });
      students.push(student);
      addSources("StudentMembership", student.membershipId, group);
    }
  });
  yield* peopleFor("Teacher", "Teacher");
  yield* peopleFor("Student", "Student");

  for (const record of classRecords) {
    const resolution = classResolution.get(`${record.scope}\u0000${record.observation.externalId}`);
    if (resolution?._tag !== "ClassGroup") continue;
    const academicYear = academicYearByExternalId.get(
      record.observation.payload.academicYearExternalId,
    );
    if (academicYear === undefined) continue;
    const teacherExternalIds = [
      record.observation.payload.classTeachers.firstExternalId,
      record.observation.payload.classTeachers.secondExternalId,
    ];
    for (const [index, teacherExternalId] of teacherExternalIds.entries()) {
      if (teacherExternalId === null) continue;
      const assignment = Organization.ClassTeacherAssignment.make({
        teacherMembershipId: domainId.membership(profile, "Teacher", teacherExternalId),
        classGroupId: resolution.classGroupId,
        academicYearId: academicYear.id,
        position: index + 1,
      });
      classTeacherAssignments.push(assignment);
      addSources(
        "ClassTeacherAssignment",
        `${assignment.teacherMembershipId}/${assignment.classGroupId}/${assignment.academicYearId}/${assignment.position}`,
        [record],
      );
    }
  }

  const providerActivities: Array<ProviderActivity> = [];
  for (const [externalId, group] of groupByExternalId(recordsWithTag(input.records, "Subject"))) {
    const record = latest(group);
    if (record === undefined) continue;
    const value = ProviderActivity.make({
      id: profile.entityId("provider-activity", externalId),
      schoolId: school.id,
      shortName: record.observation.payload.shortName,
      longName: record.observation.payload.longName,
      displayName: record.observation.payload.displayName,
      departmentIds: record.observation.payload.departments.map((department) =>
        domainId.department(profile, department.externalId),
      ),
    });
    providerActivities.push(value);
    addSources("ProviderActivity", value.id, group);
  }

  const directory = Organization.SchoolDirectory.make({
    school,
    subjectCatalog: Organization.SubjectCatalog.make({ schoolId: school.id, subjects: [] }),
    academicYears,
    terms: [],
    cohorts: [...cohorts.values()],
    departments,
    buildings,
    rooms,
    people,
    memberships,
    students,
    studentClassAssignments,
    classTeacherAssignments,
    departmentAssignments,
    classGroups: [...classGroups.values()],
    classGroupAcademicYears,
    courseOfferings: [],
    courseOfferingAcademicYears: [],
    choiceGroups: [],
    enrollments: [],
  });
  const validated = yield* Organization.validateSchoolDirectory(directory).pipe(
    Effect.mapError((error) =>
      InvalidDirectoryProjection.make({
        entityKind: error._tag,
        externalId:
          error._tag === "Organization.InvalidSchoolDirectory" ? error.entityId : school.id,
        reason: error._tag === "Organization.InvalidSchoolDirectory" ? error.reason : String(error),
      }),
    ),
  );

  const entities: Array<DirectoryEntity> = [
    DirectoryEntity.cases.School.make({
      id: validated.school.id,
      schoolId: validated.school.id,
      value: validated.school,
    }),
    ...validated.academicYears.map((value) =>
      DirectoryEntity.cases.AcademicYear.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.cohorts.map((value) =>
      DirectoryEntity.cases.Cohort.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.departments.map((value) =>
      DirectoryEntity.cases.Department.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.buildings.map((value) =>
      DirectoryEntity.cases.Building.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.rooms.map((value) =>
      DirectoryEntity.cases.Room.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.people.map((value) =>
      DirectoryEntity.cases.Person.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.memberships.map((value) =>
      DirectoryEntity.cases.SchoolMembership.make({
        id: value.id,
        schoolId: school.id,
        value,
      }),
    ),
    ...validated.students.map((value) =>
      DirectoryEntity.cases.StudentMembership.make({
        id: value.membershipId,
        schoolId: school.id,
        value,
      }),
    ),
    ...validated.studentClassAssignments.map((value) => {
      const id = `${value.studentMembershipId}/${value.classGroupId}/${PlainDate.toString(value.effective.start)}/${PlainDate.toString(value.effective.end)}`;
      return DirectoryEntity.cases.StudentClassAssignment.make({
        id,
        schoolId: school.id,
        value,
      });
    }),
    ...validated.classTeacherAssignments.map((value) => {
      const id = `${value.teacherMembershipId}/${value.classGroupId}/${value.academicYearId}/${value.position}`;
      return DirectoryEntity.cases.ClassTeacherAssignment.make({
        id,
        schoolId: school.id,
        value,
      });
    }),
    ...validated.departmentAssignments.map((value) => {
      const id = `${value.schoolMembershipId}/${value.departmentId}/${value.academicYearId}`;
      return DirectoryEntity.cases.DepartmentAssignment.make({
        id,
        schoolId: school.id,
        value,
      });
    }),
    ...validated.classGroups.map((value) =>
      DirectoryEntity.cases.ClassGroup.make({ id: value.id, schoolId: school.id, value }),
    ),
    ...validated.classGroupAcademicYears.map((value) => {
      const id = `${value.classGroupId}/${value.academicYearId}`;
      return DirectoryEntity.cases.ClassGroupAcademicYear.make({
        id,
        schoolId: school.id,
        value,
      });
    }),
    ...providerActivities.map((value) =>
      DirectoryEntity.cases.ProviderActivity.make({ id: value.id, schoolId: school.id, value }),
    ),
  ].sort((left, right) =>
    projectedKey(left._tag, left.id).localeCompare(projectedKey(right._tag, right.id)),
  );

  const entitySources = entities.map((entity) => ({
    entityKey: directoryEntityKey({
      dataSourceId,
      entityKind: entity._tag,
      entityId: entity.id,
    }),
    sourceRecordVersionIds: [
      ...(sourceVersions.get(projectedKey(entity._tag, entity.id)) ?? []),
    ].sort(),
  }));
  const diagnostics: Array<DirectoryProjectionDiagnostic> = [];
  if (unresolvedCohortEntries.size > 0) {
    diagnostics.push({ code: "UnresolvedCohortName", count: unresolvedCohortEntries.size });
  }
  if (collectionResources > 0) {
    diagnostics.push({ code: "CollectionResource", count: collectionResources });
  }
  if (providerActivities.length > 0) {
    diagnostics.push({ code: "UnresolvedActivity", count: providerActivities.length });
  }

  return {
    dataSourceId,
    schoolId: school.id,
    entities,
    entitySources,
    entityLinks: [...links.values()].sort((left, right) =>
      linkKey(left).localeCompare(linkKey(right)),
    ),
    diagnostics,
  } satisfies DirectoryProjection;
});
