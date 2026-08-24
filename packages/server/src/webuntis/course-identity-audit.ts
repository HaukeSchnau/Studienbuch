import { Schedule } from "@stu/core";
import * as Order from "effect/Order";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";

const exampleLimit = 12;

export interface CourseIdentityAuditPeriod {
  readonly academicYear: {
    readonly externalId: string;
    readonly name: string;
    readonly start: string;
    readonly end: string;
  };
  readonly occurrences: ReadonlyArray<Schedule.ProviderBackedOccurrence>;
}

export interface CourseIdentityAuditInput {
  readonly periods: ReadonlyArray<CourseIdentityAuditPeriod>;
  readonly lastingClassIdentity?:
    | ((input: {
        readonly academicYearStart: number;
        readonly shortName: string;
      }) => string | undefined)
    | undefined;
}

interface ResourceFact {
  readonly externalId: string;
  readonly shortName: string;
  readonly longName: string;
  readonly displayName: string;
}

interface OccurrenceFact {
  readonly id: string;
  readonly academicYearExternalId: string;
  readonly date: string;
  readonly activities: ReadonlyArray<ResourceFact>;
  readonly classes: ReadonlyArray<ResourceFact>;
  readonly lastingClassIds: ReadonlyArray<string>;
  readonly teachers: ReadonlyArray<ResourceFact>;
  readonly rooms: ReadonlyArray<ResourceFact>;
  readonly timeRanges: ReadonlyArray<string>;
  readonly dayStatuses: ReadonlyArray<string>;
  readonly types: ReadonlyArray<string>;
  readonly statuses: ReadonlyArray<string>;
  readonly regularTeaching: boolean;
}

interface ActivityProfile {
  readonly key: string;
  readonly academicYearExternalId: string;
  readonly externalId: string;
  readonly names: ReadonlyArray<string>;
  readonly normalizedNames: ReadonlyArray<string>;
  readonly classIds: ReadonlyArray<string>;
  readonly teacherIds: ReadonlyArray<string>;
  readonly classSignatures: ReadonlyArray<ReadonlyArray<string>>;
}

interface OverlapExample {
  readonly resourceExternalId: string;
  readonly date: string;
  readonly leftOccurrenceId: string;
  readonly rightOccurrenceId: string;
  readonly leftActivityIds: ReadonlyArray<string>;
  readonly rightActivityIds: ReadonlyArray<string>;
  readonly leftClassIds: ReadonlyArray<string>;
  readonly rightClassIds: ReadonlyArray<string>;
  readonly sameActivity: boolean;
  readonly sameTimeRange: boolean;
}

interface ActivityPairExample {
  readonly academicYearExternalId: string;
  readonly leftActivityId: string;
  readonly rightActivityId: string;
  readonly sharedNames: ReadonlyArray<string>;
  readonly sharedClassIds: ReadonlyArray<string>;
}

interface ClassComponentRiskExample {
  readonly academicYearExternalId: string;
  readonly activityExternalId: string;
  readonly names: ReadonlyArray<string>;
  readonly classSignatures: ReadonlyArray<ReadonlyArray<string>>;
  readonly hasSingleClassOverlap: boolean;
  readonly hasTransitivelyConnectedDisjointSignatures: boolean;
}

interface CrossYearCandidateExample {
  readonly fromAcademicYearExternalId: string;
  readonly toAcademicYearExternalId: string;
  readonly fromActivityId: string;
  readonly toActivityId: string;
  readonly sharedNames: ReadonlyArray<string>;
  readonly sharedClassIds: ReadonlyArray<string>;
  readonly sharedTeacherIds: ReadonlyArray<string>;
  readonly sameProviderActivityId: boolean;
}

const uniqueSorted = <Value extends string>(values: Iterable<Value>): Array<Value> =>
  [...new Set(values)].sort(Order.String);

const intersect = <Value extends string>(
  left: ReadonlyArray<Value>,
  right: ReadonlyArray<Value>,
): Array<Value> => {
  const rightValues = new Set(right);
  return left.filter((value) => rightValues.has(value));
};

const resourceKey = (resource: ResourceFact) =>
  `${resource.externalId}\u0000${resource.shortName}\u0000${resource.longName}\u0000${resource.displayName}`;

const uniqueResources = (resources: Iterable<ResourceFact>): Array<ResourceFact> => {
  const byKey = new Map<string, ResourceFact>();
  for (const resource of resources) byKey.set(resourceKey(resource), resource);
  return [...byKey.values()].sort((left, right) =>
    Order.String(resourceKey(left), resourceKey(right)),
  );
};

const normalizeName = (value: string) => value.normalize("NFKC").trim().toLowerCase();

const namesOf = (resource: ResourceFact): Array<string> =>
  uniqueSorted(
    [resource.shortName, resource.longName, resource.displayName].filter(
      (name) => name.trim().length > 0,
    ),
  );

const resourceFacts = (
  occurrence: Schedule.ProviderBackedOccurrence,
  type: "CLASS" | "SUBJECT" | "TEACHER" | "ROOM",
) =>
  uniqueResources(
    occurrence.claims.flatMap((claim) => {
      const source = claim.viewedResource.source;
      if (claim.viewedResource.type !== type || source === undefined) return [];
      return [
        {
          externalId: source.externalId,
          shortName: claim.viewedResource.shortName,
          longName: claim.viewedResource.longName,
          displayName: claim.viewedResource.displayName,
        },
      ];
    }),
  );

const yearStart = (value: string) => Number(value.slice(0, 4));

const occurrenceFact = (
  period: CourseIdentityAuditPeriod,
  occurrence: Schedule.ProviderBackedOccurrence,
  lastingClassIdentity: CourseIdentityAuditInput["lastingClassIdentity"],
): OccurrenceFact => {
  const classes = resourceFacts(occurrence, "CLASS");
  const academicYearStart = yearStart(period.academicYear.start);
  const dayStatuses = uniqueSorted(occurrence.claims.map((claim) => claim.dayStatus));
  const types = uniqueSorted(occurrence.claims.map((claim) => claim.type));
  const statuses = uniqueSorted(occurrence.claims.map((claim) => claim.status));
  return {
    id: occurrence.id,
    academicYearExternalId: period.academicYear.externalId,
    date: PlainDate.toString(occurrence.date),
    activities: resourceFacts(occurrence, "SUBJECT"),
    classes,
    lastingClassIds: uniqueSorted(
      classes.flatMap((resource) => {
        if (lastingClassIdentity === undefined) {
          return [`${period.academicYear.externalId}/class/${resource.externalId}`];
        }
        const identity = lastingClassIdentity({
          academicYearStart,
          shortName: resource.shortName,
        });
        return identity === undefined ? [] : [identity];
      }),
    ),
    teachers: resourceFacts(occurrence, "TEACHER"),
    rooms: resourceFacts(occurrence, "ROOM"),
    timeRanges: uniqueSorted(
      occurrence.claims.map(
        (claim) => `${claim.timeRange.start.toString()}/${claim.timeRange.end.toString()}`,
      ),
    ),
    dayStatuses,
    types,
    statuses,
    regularTeaching:
      dayStatuses.length === 1 &&
      dayStatuses[0] === "REGULAR" &&
      types.length === 1 &&
      types[0] === "NORMAL_TEACHING_PERIOD" &&
      statuses.length === 1 &&
      statuses[0] === "REGULAR",
  };
};

const makeActivityProfiles = (facts: ReadonlyArray<OccurrenceFact>): Array<ActivityProfile> => {
  const grouped = new Map<
    string,
    { resources: Array<ResourceFact>; facts: Array<OccurrenceFact> }
  >();
  for (const fact of facts) {
    for (const activity of fact.activities) {
      const key = `${fact.academicYearExternalId}\u0000${activity.externalId}`;
      const group = grouped.get(key) ?? { resources: [], facts: [] };
      group.resources.push(activity);
      group.facts.push(fact);
      grouped.set(key, group);
    }
  }

  const profiles: Array<ActivityProfile> = [];
  for (const [key, group] of grouped) {
    const first = group.facts[0];
    const activity = group.resources[0];
    if (first === undefined || activity === undefined) continue;
    const names = uniqueSorted(group.resources.flatMap(namesOf));
    const signatures = new Map<string, ReadonlyArray<string>>();
    for (const fact of group.facts) {
      if (fact.lastingClassIds.length === 0) continue;
      signatures.set(JSON.stringify(fact.lastingClassIds), fact.lastingClassIds);
    }
    profiles.push({
      key,
      academicYearExternalId: first.academicYearExternalId,
      externalId: activity.externalId,
      names,
      normalizedNames: uniqueSorted(names.map(normalizeName)),
      classIds: uniqueSorted(group.facts.flatMap((fact) => fact.lastingClassIds)),
      teacherIds: uniqueSorted(
        group.facts.flatMap((fact) => fact.teachers.map((teacher) => teacher.externalId)),
      ),
      classSignatures: [...signatures.values()].sort((left, right) =>
        Order.String(JSON.stringify(left), JSON.stringify(right)),
      ),
    });
  }
  return profiles.sort((left, right) => Order.String(left.key, right.key));
};

interface ResourceUse {
  readonly resourceExternalId: string;
  readonly date: string;
  readonly occurrence: OccurrenceFact;
  readonly timeRange: Schedule.LocalTimeRange.Type;
}

const resourceUses = (
  periods: ReadonlyArray<CourseIdentityAuditPeriod>,
  factsByOccurrenceId: ReadonlyMap<string, OccurrenceFact>,
  type: "TEACHER" | "ROOM",
) => {
  const uses: Array<ResourceUse> = [];
  for (const period of periods) {
    for (const occurrence of period.occurrences) {
      const fact = factsByOccurrenceId.get(occurrence.id);
      if (fact === undefined) continue;
      for (const claim of occurrence.claims) {
        const source = claim.viewedResource.source;
        if (claim.viewedResource.type !== type || source === undefined) continue;
        uses.push({
          resourceExternalId: source.externalId,
          date: fact.date,
          occurrence: fact,
          timeRange: claim.timeRange,
        });
      }
    }
  }
  return uses;
};

const overlapAudit = (uses: ReadonlyArray<ResourceUse>) => {
  const groups = new Map<string, Array<ResourceUse>>();
  for (const use of uses) {
    const key = `${use.date}\u0000${use.resourceExternalId}`;
    const group = groups.get(key) ?? [];
    group.push(use);
    groups.set(key, group);
  }

  const examples: Array<OverlapExample> = [];
  let pairs = 0;
  let sameActivityPairs = 0;
  let differentActivityPairs = 0;
  let regularTeachingPairs = 0;
  for (const group of groups.values()) {
    group.sort(
      (left, right) =>
        Order.Number(left.timeRange.start, right.timeRange.start) ||
        Order.String(left.occurrence.id, right.occurrence.id),
    );
    for (const [index, left] of group.entries()) {
      for (const right of group.slice(index + 1)) {
        if (right.timeRange.start >= left.timeRange.end) break;
        if (left.occurrence.id === right.occurrence.id) continue;
        if (!Schedule.LocalTimeRange.overlaps(left.timeRange, right.timeRange)) continue;
        const leftActivityIds = left.occurrence.activities.map((activity) => activity.externalId);
        const rightActivityIds = right.occurrence.activities.map((activity) => activity.externalId);
        const sameActivity = intersect(leftActivityIds, rightActivityIds).length > 0;
        pairs += 1;
        if (left.occurrence.regularTeaching && right.occurrence.regularTeaching) {
          regularTeachingPairs += 1;
        }
        if (sameActivity) sameActivityPairs += 1;
        else differentActivityPairs += 1;
        if (examples.length < exampleLimit) {
          examples.push({
            resourceExternalId: left.resourceExternalId,
            date: left.date,
            leftOccurrenceId: left.occurrence.id,
            rightOccurrenceId: right.occurrence.id,
            leftActivityIds,
            rightActivityIds,
            leftClassIds: left.occurrence.lastingClassIds,
            rightClassIds: right.occurrence.lastingClassIds,
            sameActivity,
            sameTimeRange:
              left.timeRange.start === right.timeRange.start &&
              left.timeRange.end === right.timeRange.end,
          });
        }
      }
    }
  }
  return { pairs, regularTeachingPairs, sameActivityPairs, differentActivityPairs, examples };
};

const sameNameSharedClassPairs = (profiles: ReadonlyArray<ActivityProfile>) => {
  const byYear = Map.groupBy(profiles, (profile) => profile.academicYearExternalId);
  const examples: Array<ActivityPairExample> = [];
  let pairs = 0;
  for (const yearProfiles of byYear.values()) {
    for (const [index, left] of yearProfiles.entries()) {
      for (const right of yearProfiles.slice(index + 1)) {
        const sharedNames = intersect(left.normalizedNames, right.normalizedNames);
        const sharedClassIds = intersect(left.classIds, right.classIds);
        if (sharedNames.length === 0 || sharedClassIds.length === 0) continue;
        pairs += 1;
        if (examples.length < exampleLimit) {
          examples.push({
            academicYearExternalId: left.academicYearExternalId,
            leftActivityId: left.externalId,
            rightActivityId: right.externalId,
            sharedNames,
            sharedClassIds,
          });
        }
      }
    }
  }
  return { pairs, examples };
};

const classComponentRisks = (profiles: ReadonlyArray<ActivityProfile>) => {
  const examples: Array<ClassComponentRiskExample> = [];
  let nonIdenticalSignatureActivities = 0;
  let singleClassOverlapActivities = 0;
  let transitiveDisjointActivities = 0;

  for (const profile of profiles) {
    const signatures = profile.classSignatures;
    if (signatures.length < 2) continue;
    nonIdenticalSignatureActivities += 1;
    const parent = signatures.map((_, index) => index);
    const find = (index: number): number => {
      const current = parent[index] ?? index;
      if (current === index) return index;
      const root = find(current);
      parent[index] = root;
      return root;
    };
    const union = (left: number, right: number) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
    };
    let hasSingleClassOverlap = false;
    for (const [leftIndex, left] of signatures.entries()) {
      for (const [rightIndex, right] of signatures.entries()) {
        if (rightIndex <= leftIndex) continue;
        const shared = intersect(left, right);
        if (shared.length === 0) continue;
        if (shared.length === 1) hasSingleClassOverlap = true;
        union(leftIndex, rightIndex);
      }
    }
    let hasTransitivelyConnectedDisjointSignatures = false;
    for (const [leftIndex, left] of signatures.entries()) {
      for (const [rightIndex, right] of signatures.entries()) {
        if (rightIndex <= leftIndex || find(leftIndex) !== find(rightIndex)) continue;
        if (intersect(left, right).length === 0) hasTransitivelyConnectedDisjointSignatures = true;
      }
    }
    if (hasSingleClassOverlap) singleClassOverlapActivities += 1;
    if (hasTransitivelyConnectedDisjointSignatures) transitiveDisjointActivities += 1;
    if (
      examples.length < exampleLimit &&
      (hasSingleClassOverlap || hasTransitivelyConnectedDisjointSignatures)
    ) {
      examples.push({
        academicYearExternalId: profile.academicYearExternalId,
        activityExternalId: profile.externalId,
        names: profile.names,
        classSignatures: signatures,
        hasSingleClassOverlap,
        hasTransitivelyConnectedDisjointSignatures,
      });
    }
  }

  return {
    nonIdenticalSignatureActivities,
    singleClassOverlapActivities,
    transitiveDisjointActivities,
    examples,
  };
};

const crossYearCandidates = (
  periods: ReadonlyArray<CourseIdentityAuditPeriod>,
  profiles: ReadonlyArray<ActivityProfile>,
) => {
  const sortedPeriods = [...periods].sort((left, right) =>
    Order.String(left.academicYear.start, right.academicYear.start),
  );
  const profilesByYear = Map.groupBy(profiles, (profile) => profile.academicYearExternalId);
  const examples: Array<CrossYearCandidateExample> = [];
  const candidatesByProfile = new Map<string, number>();
  let candidates = 0;
  let sameProviderActivityId = 0;
  let changedProviderActivityId = 0;

  for (const [index, fromPeriod] of sortedPeriods.entries()) {
    const toPeriod = sortedPeriods[index + 1];
    if (toPeriod === undefined) continue;
    if (yearStart(toPeriod.academicYear.start) - yearStart(fromPeriod.academicYear.start) !== 1) {
      continue;
    }
    const fromProfiles = profilesByYear.get(fromPeriod.academicYear.externalId) ?? [];
    const toProfiles = profilesByYear.get(toPeriod.academicYear.externalId) ?? [];
    for (const from of fromProfiles) {
      for (const to of toProfiles) {
        const providerIdentityContinues = from.externalId === to.externalId;
        const sharedNames = intersect(from.normalizedNames, to.normalizedNames);
        const sharedClassIds = intersect(from.classIds, to.classIds);
        const sharedTeacherIds = intersect(from.teacherIds, to.teacherIds);
        if (
          !providerIdentityContinues &&
          (sharedNames.length === 0 ||
            (sharedClassIds.length === 0 && sharedTeacherIds.length === 0))
        ) {
          continue;
        }
        candidates += 1;
        if (providerIdentityContinues) sameProviderActivityId += 1;
        else changedProviderActivityId += 1;
        candidatesByProfile.set(from.key, (candidatesByProfile.get(from.key) ?? 0) + 1);
        candidatesByProfile.set(to.key, (candidatesByProfile.get(to.key) ?? 0) + 1);
        if (examples.length < exampleLimit) {
          examples.push({
            fromAcademicYearExternalId: from.academicYearExternalId,
            toAcademicYearExternalId: to.academicYearExternalId,
            fromActivityId: from.externalId,
            toActivityId: to.externalId,
            sharedNames,
            sharedClassIds,
            sharedTeacherIds,
            sameProviderActivityId: providerIdentityContinues,
          });
        }
      }
    }
  }

  return {
    candidates,
    sameProviderActivityId,
    changedProviderActivityId,
    ambiguousProfiles: [...candidatesByProfile.values()].filter((count) => count > 1).length,
    examples,
  };
};

/** Audits provider and school evidence without deciding durable course identity. */
export const makeCourseIdentityAudit = (input: CourseIdentityAuditInput) => {
  const periods = [...input.periods].sort(
    (left, right) =>
      Order.String(left.academicYear.start, right.academicYear.start) ||
      Order.String(left.academicYear.externalId, right.academicYear.externalId),
  );
  const facts = periods.flatMap((period) =>
    [...period.occurrences]
      .sort((left, right) => Order.String(left.id, right.id))
      .map((occurrence) => occurrenceFact(period, occurrence, input.lastingClassIdentity)),
  );
  const factsByOccurrenceId = new Map(facts.map((fact) => [fact.id, fact]));
  const profiles = makeActivityProfiles(facts);
  const regularTeachingFacts = facts.filter((fact) => fact.regularTeaching);
  const regularTeachingProfiles = makeActivityProfiles(regularTeachingFacts);
  const teacherOverlaps = overlapAudit(resourceUses(periods, factsByOccurrenceId, "TEACHER"));
  const roomOverlaps = overlapAudit(resourceUses(periods, factsByOccurrenceId, "ROOM"));

  return {
    periods: periods.map((period) => ({
      academicYear: period.academicYear,
      occurrences: period.occurrences.length,
      claims: period.occurrences.reduce((count, occurrence) => count + occurrence.claims.length, 0),
    })),
    occurrenceEvidence: {
      occurrences: facts.length,
      claims: periods.reduce(
        (count, period) =>
          count + period.occurrences.reduce((sum, occurrence) => sum + occurrence.claims.length, 0),
        0,
      ),
      withAllFourResourceViews: facts.filter(
        (fact) =>
          fact.activities.length > 0 &&
          fact.classes.length > 0 &&
          fact.teachers.length > 0 &&
          fact.rooms.length > 0,
      ).length,
      regularTeaching: regularTeachingFacts.length,
      withoutActivity: facts.filter((fact) => fact.activities.length === 0).length,
      withMultipleActivities: facts.filter((fact) => fact.activities.length > 1).length,
      withConflictingTimeRanges: facts.filter((fact) => fact.timeRanges.length > 1).length,
      withConflictingTypes: facts.filter((fact) => fact.types.length > 1).length,
      withConflictingStatuses: facts.filter((fact) => fact.statuses.length > 1).length,
      withConflictingDayStatuses: facts.filter((fact) => fact.dayStatuses.length > 1).length,
    },
    physicalConstraints: {
      teacherOverlaps,
      roomOverlaps,
    },
    activityEvidence: {
      annualProviderActivities: profiles.length,
      providerActivityIds: new Set(profiles.map((profile) => profile.externalId)).size,
      withMultipleNameForms: profiles.filter((profile) => profile.normalizedNames.length > 1)
        .length,
      withoutClasses: profiles.filter((profile) => profile.classIds.length === 0).length,
      sameNameSharedClass: {
        all: sameNameSharedClassPairs(profiles),
        regularTeaching: sameNameSharedClassPairs(regularTeachingProfiles),
      },
      connectedClassRisk: {
        all: classComponentRisks(profiles),
        regularTeaching: classComponentRisks(regularTeachingProfiles),
      },
    },
    crossYearContinuity: crossYearCandidates(periods, regularTeachingProfiles),
  };
};
