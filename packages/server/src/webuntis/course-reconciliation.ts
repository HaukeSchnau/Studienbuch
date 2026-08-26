import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import { sha256Text } from "../cryptography/content-hash.ts";
import type { CourseRosterObservation } from "./student-timetable.ts";

export interface RosterContinuityMeasurement {
  readonly leftStudents: number;
  readonly rightStudents: number;
  readonly sharedStudents: number;
  readonly unionStudents: number;
  readonly jaccard: number;
  readonly retainedFromLeft: number;
  readonly retainedFromRight: number;
}

/** School-owned rules for turning evidence into an automatic identity decision. */
export interface CourseReconciliationPolicy {
  readonly ruleId: string;
  readonly minimumRegularOccurrences: number;
  readonly minimumRepeatedJointOccurrences: number;
  readonly isJointCourseCode: (code: string) => boolean;
  readonly codesCompatible: (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => boolean;
  readonly isStrongRosterContinuity: (measurement: RosterContinuityMeasurement) => boolean;
}

export const CourseRosterPartition = Schema.Struct({
  schoolGroupKey: Schema.String,
  studentExternalIds: Schema.NonEmptyArray(Schema.String),
});
export interface CourseRosterPartition extends Schema.Schema.Type<typeof CourseRosterPartition> {}

export const AnnualCourseConstructionEvidence = Schema.TaggedUnion({
  RepeatedRoster: {
    regularOccurrences: Schema.Int,
  },
  RepeatedJointRows: {
    ruleId: Schema.String,
    regularOccurrences: Schema.Int,
    simultaneousOccurrences: Schema.Int,
    componentObservationIds: Schema.NonEmptyArray(Schema.String),
  },
});
export type AnnualCourseConstructionEvidence = typeof AnnualCourseConstructionEvidence.Type;

/** A provider-backed annual pattern. It has not received a permanent domain ID yet. */
export const AnnualCourseObservation = Schema.Struct({
  id: Schema.String,
  academicYearExternalId: Schema.String,
  courseCodes: Schema.Array(Schema.String),
  activityExternalIds: Schema.Array(Schema.String),
  teacherExternalIds: Schema.Array(Schema.String),
  classExternalIds: Schema.Array(Schema.String),
  studentExternalIds: Schema.NonEmptyArray(Schema.String),
  rosterPartitions: Schema.Array(CourseRosterPartition),
  datedObservationIds: Schema.NonEmptyArray(Schema.String),
  construction: AnnualCourseConstructionEvidence,
});
export interface AnnualCourseObservation extends Schema.Schema.Type<
  typeof AnnualCourseObservation
> {}

export interface AnnualCourseObservationBuild {
  readonly observations: ReadonlyArray<AnnualCourseObservation>;
  readonly unresolvedDatedObservationIds: ReadonlyArray<string>;
}

interface AnnualPattern {
  readonly id: string;
  readonly observations: ReadonlyArray<CourseRosterObservation>;
  readonly annual: AnnualCourseObservation;
}

const uniqueSorted = (values: Iterable<string>) => [...new Set(values)].sort(Order.String);

const intersect = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => {
  const rightValues = new Set(right);
  return left.filter((value) => rightValues.has(value));
};

const studentIds = (observation: CourseRosterObservation) =>
  observation.members.map((member) => member.studentExternalId).sort(Order.String);

const patternKey = (observation: CourseRosterObservation) => {
  const codeOrActivity =
    observation.courseCodes.length > 0
      ? ["code", ...observation.courseCodes]
      : ["activity", ...observation.activityExternalIds];
  return JSON.stringify([
    observation.academicYearExternalId,
    codeOrActivity,
    studentIds(observation),
  ]);
};

const patternFingerprint = (observation: CourseRosterObservation) =>
  sha256Text(patternKey(observation));

const partitionsOf = (observations: ReadonlyArray<CourseRosterObservation>) => {
  const studentsByGroup = new Map<string, Set<string>>();
  for (const observation of observations) {
    for (const member of observation.members) {
      for (const schoolGroupKey of member.schoolGroupKeys) {
        const students = studentsByGroup.get(schoolGroupKey) ?? new Set<string>();
        students.add(member.studentExternalId);
        studentsByGroup.set(schoolGroupKey, students);
      }
    }
  }
  return [...studentsByGroup.entries()]
    .flatMap(([schoolGroupKey, students]) => {
      const studentExternalIds = [...students].sort(Order.String);
      const firstStudentExternalId = studentExternalIds[0];
      return firstStudentExternalId === undefined
        ? []
        : [
            CourseRosterPartition.make({
              schoolGroupKey,
              studentExternalIds: [firstStudentExternalId, ...studentExternalIds.slice(1)],
            }),
          ];
    })
    .sort((left, right) => Order.String(left.schoolGroupKey, right.schoolGroupKey));
};

const makePattern = Effect.fnUntraced(function* (
  observations: ReadonlyArray<CourseRosterObservation>,
) {
  const first = observations[0];
  if (first === undefined) return undefined;
  const students = uniqueSorted(observations.flatMap(studentIds));
  const firstStudent = students[0];
  const datedObservationIds = observations.map((item) => item.id).sort(Order.String);
  const firstDatedObservationId = datedObservationIds[0];
  if (firstStudent === undefined || firstDatedObservationId === undefined) return undefined;
  const id = `annual:${first.academicYearExternalId}/roster:${yield* patternFingerprint(first)}`;
  return {
    id,
    observations,
    annual: AnnualCourseObservation.make({
      id,
      academicYearExternalId: first.academicYearExternalId,
      courseCodes: uniqueSorted(observations.flatMap((item) => item.courseCodes)),
      activityExternalIds: uniqueSorted(observations.flatMap((item) => item.activityExternalIds)),
      teacherExternalIds: uniqueSorted(observations.flatMap((item) => item.teacherExternalIds)),
      classExternalIds: uniqueSorted(observations.flatMap((item) => item.classExternalIds)),
      studentExternalIds: [firstStudent, ...students.slice(1)],
      rosterPartitions: partitionsOf(observations),
      datedObservationIds: [firstDatedObservationId, ...datedObservationIds.slice(1)],
      construction: AnnualCourseConstructionEvidence.make({
        _tag: "RepeatedRoster",
        regularOccurrences: datedObservationIds.length,
      }),
    }),
  };
});

const simultaneousOccurrenceCount = (left: AnnualPattern, right: AnnualPattern) => {
  const meetings = new Set<string>();
  for (const leftOccurrence of left.observations) {
    for (const rightOccurrence of right.observations) {
      const sharedTimeRanges = intersect(leftOccurrence.timeRanges, rightOccurrence.timeRanges);
      const sharedTeachers = intersect(
        leftOccurrence.teacherExternalIds,
        rightOccurrence.teacherExternalIds,
      );
      if (
        leftOccurrence.date === rightOccurrence.date &&
        sharedTimeRanges.length > 0 &&
        sharedTeachers.length > 0
      ) {
        meetings.add(JSON.stringify([leftOccurrence.date, sharedTimeRanges, sharedTeachers]));
      }
    }
  }
  return meetings.size;
};

const jointCode = (left: AnnualPattern, right: AnnualPattern, policy: CourseReconciliationPolicy) =>
  intersect(left.annual.courseCodes, right.annual.courseCodes).find(policy.isJointCourseCode);

const canJoin = (left: AnnualPattern, right: AnnualPattern, policy: CourseReconciliationPolicy) => {
  if (left.annual.academicYearExternalId !== right.annual.academicYearExternalId) return false;
  if (jointCode(left, right, policy) === undefined) return false;
  if (intersect(left.annual.studentExternalIds, right.annual.studentExternalIds).length > 0) {
    return false;
  }
  return simultaneousOccurrenceCount(left, right) >= policy.minimumRepeatedJointOccurrences;
};

const combineJointPatterns = (
  left: AnnualPattern,
  right: AnnualPattern,
  policy: CourseReconciliationPolicy,
): AnnualPattern => {
  const observations = [...left.observations, ...right.observations].sort((a, b) =>
    Order.String(a.id, b.id),
  );
  const students = uniqueSorted([
    ...left.annual.studentExternalIds,
    ...right.annual.studentExternalIds,
  ]);
  const firstStudent = students[0];
  const datedObservationIds = uniqueSorted(observations.map((item) => item.id));
  const firstDatedObservationId = datedObservationIds[0];
  if (firstStudent === undefined || firstDatedObservationId === undefined) return left;
  const componentObservationIds = [left.id, right.id].sort(Order.String);
  const firstComponentObservationId = componentObservationIds[0];
  if (firstComponentObservationId === undefined) return left;
  const id = `annual:${left.annual.academicYearExternalId}/joint:${componentObservationIds.join("+")}`;
  return {
    id,
    observations,
    annual: AnnualCourseObservation.make({
      id,
      academicYearExternalId: left.annual.academicYearExternalId,
      courseCodes: uniqueSorted([...left.annual.courseCodes, ...right.annual.courseCodes]),
      activityExternalIds: uniqueSorted([
        ...left.annual.activityExternalIds,
        ...right.annual.activityExternalIds,
      ]),
      teacherExternalIds: uniqueSorted([
        ...left.annual.teacherExternalIds,
        ...right.annual.teacherExternalIds,
      ]),
      classExternalIds: uniqueSorted([
        ...left.annual.classExternalIds,
        ...right.annual.classExternalIds,
      ]),
      studentExternalIds: [firstStudent, ...students.slice(1)],
      rosterPartitions: partitionsOf(observations),
      datedObservationIds: [firstDatedObservationId, ...datedObservationIds.slice(1)],
      construction: AnnualCourseConstructionEvidence.make({
        _tag: "RepeatedJointRows",
        ruleId: policy.ruleId,
        regularOccurrences: datedObservationIds.length,
        simultaneousOccurrences: simultaneousOccurrenceCount(left, right),
        componentObservationIds: [firstComponentObservationId, ...componentObservationIds.slice(1)],
      }),
    }),
  };
};

/** Finds repeated annual patterns without allocating permanent course identities. */
export const buildAnnualCourseObservations = Effect.fnUntraced(function* (
  datedObservations: ReadonlyArray<CourseRosterObservation>,
  policy: CourseReconciliationPolicy,
) {
  const groups = new Map<string, Array<CourseRosterObservation>>();
  const unresolvedDatedObservationIds: Array<string> = [];
  for (const observation of [...datedObservations].sort((left, right) =>
    Order.String(left.id, right.id),
  )) {
    if (!observation.regularTeaching) {
      unresolvedDatedObservationIds.push(observation.id);
      continue;
    }
    const key = patternKey(observation);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const accepted: Array<AnnualPattern> = [];
  for (const group of groups.values()) {
    const observedDates = new Set(group.map((item) => item.date)).size;
    if (observedDates < policy.minimumRegularOccurrences) {
      unresolvedDatedObservationIds.push(...group.map((item) => item.id));
      continue;
    }
    const pattern = yield* makePattern(group);
    if (pattern !== undefined) accepted.push(pattern);
  }
  accepted.sort((left, right) => Order.String(left.id, right.id));

  const eligiblePartners = new Map<string, Array<AnnualPattern>>();
  for (const [index, left] of accepted.entries()) {
    for (const right of accepted.slice(index + 1)) {
      if (!canJoin(left, right, policy)) continue;
      const leftPartners = eligiblePartners.get(left.id) ?? [];
      leftPartners.push(right);
      eligiblePartners.set(left.id, leftPartners);
      const rightPartners = eligiblePartners.get(right.id) ?? [];
      rightPartners.push(left);
      eligiblePartners.set(right.id, rightPartners);
    }
  }

  const consumed = new Set<string>();
  const annual: Array<AnnualCourseObservation> = [];
  for (const pattern of accepted) {
    if (consumed.has(pattern.id)) continue;
    const [partner] = eligiblePartners.get(pattern.id) ?? [];
    const partnerCandidates = partner === undefined ? [] : (eligiblePartners.get(partner.id) ?? []);
    if (
      partner !== undefined &&
      (eligiblePartners.get(pattern.id)?.length ?? 0) === 1 &&
      partnerCandidates.length === 1 &&
      partnerCandidates[0]?.id === pattern.id
    ) {
      consumed.add(pattern.id);
      consumed.add(partner.id);
      annual.push(combineJointPatterns(pattern, partner, policy).annual);
    } else {
      consumed.add(pattern.id);
      annual.push(pattern.annual);
    }
  }

  return {
    observations: annual.sort((left, right) => Order.String(left.id, right.id)),
    unresolvedDatedObservationIds: uniqueSorted(unresolvedDatedObservationIds),
  };
});

export const CoursePairEvidence = Schema.Struct({
  sharedCourseCodes: Schema.Array(Schema.String),
  sharedActivityExternalIds: Schema.Array(Schema.String),
  sharedTeacherExternalIds: Schema.Array(Schema.String),
  sharedSchoolGroupKeys: Schema.Array(Schema.String),
  roster: Schema.Struct({
    leftStudents: Schema.Int,
    rightStudents: Schema.Int,
    sharedStudents: Schema.Int,
    unionStudents: Schema.Int,
    jaccard: Schema.Finite,
    retainedFromLeft: Schema.Finite,
    retainedFromRight: Schema.Finite,
  }),
  strongRosterContinuity: Schema.Boolean,
  corroborated: Schema.Boolean,
});
export interface CoursePairEvidence extends Schema.Schema.Type<typeof CoursePairEvidence> {}

const decisionFields = {
  ruleId: Schema.String,
  leftObservationId: Schema.String,
  rightObservationId: Schema.String,
  evidence: CoursePairEvidence,
} as const;

export const CourseIdentityDecision = Schema.TaggedUnion({
  Same: decisionFields,
  Different: decisionFields,
  Compatible: decisionFields,
  Ambiguous: decisionFields,
});
export type CourseIdentityDecision = typeof CourseIdentityDecision.Type;

const partitionMap = (observation: AnnualCourseObservation) =>
  new Map(
    observation.rosterPartitions.map((partition) => [
      partition.schoolGroupKey,
      partition.studentExternalIds,
    ]),
  );

const measurement = (
  left: AnnualCourseObservation,
  right: AnnualCourseObservation,
  sharedSchoolGroupKeys: ReadonlyArray<string>,
): RosterContinuityMeasurement => {
  const leftPartitions = partitionMap(left);
  const rightPartitions = partitionMap(right);
  const leftStudents = uniqueSorted(
    sharedSchoolGroupKeys.length === 0
      ? left.studentExternalIds
      : sharedSchoolGroupKeys.flatMap((key) => leftPartitions.get(key) ?? []),
  );
  const rightStudents = uniqueSorted(
    sharedSchoolGroupKeys.length === 0
      ? right.studentExternalIds
      : sharedSchoolGroupKeys.flatMap((key) => rightPartitions.get(key) ?? []),
  );
  const sharedStudents = intersect(leftStudents, rightStudents).length;
  const unionStudents = new Set([...leftStudents, ...rightStudents]).size;
  return {
    leftStudents: leftStudents.length,
    rightStudents: rightStudents.length,
    sharedStudents,
    unionStudents,
    jaccard: unionStudents === 0 ? 0 : sharedStudents / unionStudents,
    retainedFromLeft: leftStudents.length === 0 ? 0 : sharedStudents / leftStudents.length,
    retainedFromRight: rightStudents.length === 0 ? 0 : sharedStudents / rightStudents.length,
  };
};

const evidenceFor = (
  left: AnnualCourseObservation,
  right: AnnualCourseObservation,
  policy: CourseReconciliationPolicy,
) => {
  const sharedSchoolGroupKeys = intersect(
    left.rosterPartitions.map((partition) => partition.schoolGroupKey),
    right.rosterPartitions.map((partition) => partition.schoolGroupKey),
  );
  const roster = measurement(left, right, sharedSchoolGroupKeys);
  const sharedCourseCodes = intersect(left.courseCodes, right.courseCodes);
  const sharedActivityExternalIds = intersect(left.activityExternalIds, right.activityExternalIds);
  const sharedTeacherExternalIds = intersect(left.teacherExternalIds, right.teacherExternalIds);
  const corroborated =
    policy.codesCompatible(left.courseCodes, right.courseCodes) ||
    sharedActivityExternalIds.length > 0;
  return CoursePairEvidence.make({
    sharedCourseCodes,
    sharedActivityExternalIds,
    sharedTeacherExternalIds,
    sharedSchoolGroupKeys,
    roster,
    strongRosterContinuity:
      sharedSchoolGroupKeys.length > 0 && policy.isStrongRosterContinuity(roster),
    corroborated,
  });
};

/**
 * Classifies every adjacent-year pair. `Same` requires a unique strong match in both directions;
 * the function therefore stays deterministic when candidates arrive in another order.
 */
export const reconcileAnnualCourseObservations = (
  leftObservations: ReadonlyArray<AnnualCourseObservation>,
  rightObservations: ReadonlyArray<AnnualCourseObservation>,
  policy: CourseReconciliationPolicy,
): ReadonlyArray<CourseIdentityDecision> => {
  const pairs = [...leftObservations]
    .sort((left, right) => Order.String(left.id, right.id))
    .flatMap((left) =>
      [...rightObservations]
        .sort((a, b) => Order.String(a.id, b.id))
        .map((right) => ({ left, right, evidence: evidenceFor(left, right, policy) })),
    );
  const strongPairs = pairs.filter((pair) => pair.evidence.strongRosterContinuity);
  const strongLeftCounts = new Map<string, number>();
  const strongRightCounts = new Map<string, number>();
  for (const pair of strongPairs) {
    strongLeftCounts.set(pair.left.id, (strongLeftCounts.get(pair.left.id) ?? 0) + 1);
    strongRightCounts.set(pair.right.id, (strongRightCounts.get(pair.right.id) ?? 0) + 1);
  }

  return pairs.map(({ left, right, evidence }) => {
    const fields = {
      ruleId: policy.ruleId,
      leftObservationId: left.id,
      rightObservationId: right.id,
      evidence,
    };
    if (evidence.strongRosterContinuity && evidence.corroborated) {
      return CourseIdentityDecision.make({
        _tag:
          strongLeftCounts.get(left.id) === 1 && strongRightCounts.get(right.id) === 1
            ? "Same"
            : "Ambiguous",
        ...fields,
      });
    }
    if (evidence.strongRosterContinuity && !evidence.corroborated) {
      return CourseIdentityDecision.make({ _tag: "Ambiguous", ...fields });
    }
    if (
      evidence.sharedCourseCodes.length > 0 ||
      evidence.sharedActivityExternalIds.length > 0 ||
      evidence.roster.sharedStudents > 0
    ) {
      return CourseIdentityDecision.make({ _tag: "Compatible", ...fields });
    }
    return CourseIdentityDecision.make({ _tag: "Different", ...fields });
  });
};
