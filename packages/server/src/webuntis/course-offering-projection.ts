import { Organization } from "@stu/core";
import type { Importing, Schedule } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

export type CourseOfferingAnchor =
  | { readonly _tag: "ClassGroup"; readonly classGroupId: Organization.ClassGroupId }
  | {
      readonly _tag: "Teacher";
      readonly teacherMembershipId: Organization.SchoolMembershipId;
    }
  | { readonly _tag: "Unassigned" };

export interface CourseOfferingIdentityInput {
  readonly dataSourceId: Importing.DataSourceId;
  readonly academicYearId: Organization.AcademicYearId;
  readonly providerActivityExternalId: Importing.ExternalId;
  readonly anchor: CourseOfferingAnchor;
}

export interface ProjectCourseOfferingsInput {
  readonly schoolId: Organization.SchoolId;
  readonly occurrences: ReadonlyArray<Schedule.ProviderBackedOccurrence>;
  readonly courseOfferingId: (input: CourseOfferingIdentityInput) => Organization.CourseOfferingId;
}

export interface CourseOfferingEvidence {
  readonly courseOfferingId: Organization.CourseOfferingId;
  readonly providerActivity: Importing.SourceIdentity;
  readonly occurrenceIds: ReadonlyArray<Schedule.DatedOccurrenceId>;
  readonly teacherMembershipIds: ReadonlyArray<Organization.SchoolMembershipId>;
  readonly anchor: CourseOfferingAnchor;
}

export interface CourseOfferingProjectionDiagnostic {
  readonly code: "AmbiguousAcademicYear" | "AmbiguousProviderActivity" | "UnassignedOffering";
  readonly count: number;
}

export interface CourseOfferingProjection {
  readonly offerings: ReadonlyArray<Organization.CourseOffering>;
  readonly evidence: ReadonlyArray<CourseOfferingEvidence>;
  readonly diagnostics: ReadonlyArray<CourseOfferingProjectionDiagnostic>;
  readonly unresolvedSubjectOfferings: number;
}

export class InvalidCourseOfferingProjection extends Schema.TaggedError<InvalidCourseOfferingProjection>()(
  "WebUntis.InvalidCourseOfferingProjection",
  { occurrenceId: Schema.String, reason: Schema.String },
) {}

interface OccurrenceEvidence {
  readonly occurrenceId: Schedule.DatedOccurrenceId;
  readonly activity: Schedule.ProviderOccurrenceResource & {
    readonly source: Importing.SourceIdentity;
  };
  readonly academicYearId: Organization.AcademicYearId;
  readonly classGroupIds: ReadonlyArray<Organization.ClassGroupId>;
  readonly teacherMembershipIds: ReadonlyArray<Organization.SchoolMembershipId>;
  readonly subjectIds: ReadonlyArray<Organization.SubjectId>;
}

const uniqueSorted = <Value extends string>(values: Iterable<Value>): Array<Value> =>
  [...new Set(values)].sort(Order.String);

const increment = (
  diagnostics: Map<CourseOfferingProjectionDiagnostic["code"], number>,
  code: CourseOfferingProjectionDiagnostic["code"],
) => diagnostics.set(code, (diagnostics.get(code) ?? 0) + 1);

const linkedAcademicYearIds = (occurrence: Schedule.ProviderBackedOccurrence) =>
  uniqueSorted(
    occurrence.claims.flatMap((claim) =>
      claim.academicYear.entityLink?._tag === "AcademicYear"
        ? [claim.academicYear.entityLink.academicYearId]
        : [],
    ),
  );

const providerActivities = (occurrence: Schedule.ProviderBackedOccurrence) => {
  const activities = new Map<string, OccurrenceEvidence["activity"]>();
  for (const claim of occurrence.claims) {
    const source = claim.viewedResource.source;
    if (claim.viewedResource.type !== "SUBJECT" || source?.entityKind !== "Subject") continue;
    activities.set(`${source.dataSourceId}\u0000${source.externalId}`, {
      ...claim.viewedResource,
      source,
    });
  }
  return [...activities.values()];
};

const occurrenceEvidence = (
  occurrence: Schedule.ProviderBackedOccurrence,
  diagnostics: Map<CourseOfferingProjectionDiagnostic["code"], number>,
): OccurrenceEvidence | undefined => {
  const academicYearIds = linkedAcademicYearIds(occurrence);
  if (academicYearIds.length !== 1) {
    increment(diagnostics, "AmbiguousAcademicYear");
    return undefined;
  }
  const activities = providerActivities(occurrence);
  if (activities.length !== 1) {
    increment(diagnostics, "AmbiguousProviderActivity");
    return undefined;
  }
  const academicYearId = academicYearIds[0];
  const activity = activities[0];
  if (academicYearId === undefined || activity === undefined) return undefined;

  return {
    occurrenceId: occurrence.id,
    activity,
    academicYearId,
    classGroupIds: uniqueSorted(
      occurrence.claims.flatMap((claim) =>
        claim.viewedResource.entityLink?._tag === "ClassGroup"
          ? [claim.viewedResource.entityLink.classGroupId]
          : [],
      ),
    ),
    teacherMembershipIds: uniqueSorted(
      occurrence.claims.flatMap((claim) =>
        claim.viewedResource.entityLink?._tag === "SchoolMembership"
          ? [claim.viewedResource.entityLink.schoolMembershipId]
          : [],
      ),
    ),
    subjectIds: uniqueSorted(
      occurrence.claims.flatMap((claim) =>
        claim.viewedResource.entityLink?._tag === "Subject"
          ? [claim.viewedResource.entityLink.subjectId]
          : [],
      ),
    ),
  };
};

/** Connected components preserve cross-class courses without using dated entry IDs as identity. */
const connectedComponents = <Participant extends string>(
  evidence: ReadonlyArray<OccurrenceEvidence>,
  participants: (item: OccurrenceEvidence) => ReadonlyArray<Participant>,
) => {
  const parent = new Map<Participant, Participant>();
  const find = (participant: Participant): Participant => {
    const current = parent.get(participant);
    if (current === undefined) {
      parent.set(participant, participant);
      return participant;
    }
    if (current === participant) return participant;
    const root = find(current);
    parent.set(participant, root);
    return root;
  };
  const union = (left: Participant, right: Participant) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort(Order.String);
    if (first !== undefined && second !== undefined) parent.set(second, first);
  };

  for (const item of evidence) {
    const [first, ...rest] = participants(item);
    if (first === undefined) continue;
    find(first);
    for (const participant of rest) union(first, participant);
  }

  const groups = new Map<Participant, Array<OccurrenceEvidence>>();
  for (const item of evidence) {
    const first = participants(item)[0];
    if (first === undefined) continue;
    const root = find(first);
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  }
  return [...groups.entries()].sort(([left], [right]) => Order.String(left, right));
};

const preferredName = (activity: OccurrenceEvidence["activity"]) =>
  [activity.displayName, activity.shortName, activity.longName].find(
    (candidate) => candidate.trim().length > 0,
  ) ?? "Unbenannte Aktivität";

const projectGroup = Effect.fnUntraced(function* (
  input: ProjectCourseOfferingsInput,
  group: ReadonlyArray<OccurrenceEvidence>,
  anchor: CourseOfferingAnchor,
) {
  const first = group[0];
  if (first === undefined) return undefined;
  const courseOfferingId = input.courseOfferingId({
    dataSourceId: first.activity.source.dataSourceId,
    academicYearId: first.academicYearId,
    providerActivityExternalId: first.activity.source.externalId,
    anchor,
  });
  const classGroupIds = uniqueSorted(group.flatMap((item) => item.classGroupIds));
  const subjectIds = uniqueSorted(group.flatMap((item) => item.subjectIds));
  const offering = yield* Schema.decodeEffect(Organization.CourseOffering)({
    id: courseOfferingId,
    schoolId: input.schoolId,
    academicYearId: first.academicYearId,
    subjectId: subjectIds.length === 1 ? subjectIds[0] : undefined,
    name: preferredName(first.activity),
    classGroupIds,
  }).pipe(
    Effect.mapError((error) =>
      InvalidCourseOfferingProjection.make({
        occurrenceId: first.occurrenceId,
        reason: String(error),
      }),
    ),
  );
  return {
    offering,
    evidence: {
      courseOfferingId,
      providerActivity: first.activity.source,
      occurrenceIds: uniqueSorted(group.map((item) => item.occurrenceId)),
      teacherMembershipIds: uniqueSorted(group.flatMap((item) => item.teacherMembershipIds)),
      anchor,
    } satisfies CourseOfferingEvidence,
  };
});

export const projectCourseOfferings = Effect.fn("WebUntis.projectCourseOfferings")(function* (
  input: ProjectCourseOfferingsInput,
) {
  const diagnosticCounts = new Map<CourseOfferingProjectionDiagnostic["code"], number>();
  const usable = input.occurrences.flatMap((occurrence) => {
    const evidence = occurrenceEvidence(occurrence, diagnosticCounts);
    return evidence === undefined ? [] : [evidence];
  });
  const byActivity = Map.groupBy(
    usable,
    (item) =>
      `${item.academicYearId}\u0000${item.activity.source.dataSourceId}\u0000${item.activity.source.externalId}`,
  );
  const projected: Array<{
    offering: Organization.CourseOffering;
    evidence: CourseOfferingEvidence;
  }> = [];

  for (const activityEvidence of byActivity.values()) {
    const withClasses = activityEvidence.filter((item) => item.classGroupIds.length > 0);
    for (const [classGroupId, group] of connectedComponents(
      withClasses,
      (item) => item.classGroupIds,
    )) {
      const item = yield* projectGroup(input, group, { _tag: "ClassGroup", classGroupId });
      if (item !== undefined) projected.push(item);
    }

    const withoutClasses = activityEvidence.filter((item) => item.classGroupIds.length === 0);
    const withTeachers = withoutClasses.filter((item) => item.teacherMembershipIds.length > 0);
    for (const [teacherMembershipId, group] of connectedComponents(
      withTeachers,
      (item) => item.teacherMembershipIds,
    )) {
      const item = yield* projectGroup(input, group, { _tag: "Teacher", teacherMembershipId });
      if (item !== undefined) projected.push(item);
    }

    const unassigned = withoutClasses.filter((item) => item.teacherMembershipIds.length === 0);
    if (unassigned.length > 0) {
      increment(diagnosticCounts, "UnassignedOffering");
      const item = yield* projectGroup(input, unassigned, { _tag: "Unassigned" });
      if (item !== undefined) projected.push(item);
    }
  }

  projected.sort((left, right) => Order.String(left.offering.id, right.offering.id));
  return {
    offerings: projected.map((item) => item.offering),
    evidence: projected.map((item) => item.evidence),
    diagnostics: [...diagnosticCounts.entries()]
      .sort(([left], [right]) => Order.String(left, right))
      .map(([code, count]) => ({ code, count })),
    unresolvedSubjectOfferings: projected.filter((item) => item.offering.subjectId === undefined)
      .length,
  } satisfies CourseOfferingProjection;
});
