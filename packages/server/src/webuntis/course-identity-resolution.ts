import * as Order from "effect/Order";
import type {
  CourseIdentityDecision,
  CourseReconciliationPolicy,
} from "./course-reconciliation.ts";
import {
  type AnnualCourseObservation,
  reconcileAnnualCourseObservations,
} from "./course-reconciliation.ts";

export interface AnnualCoursePeriod {
  readonly academicYearExternalId: string;
  readonly startsOn: string;
  readonly observations: ReadonlyArray<AnnualCourseObservation>;
}

export interface ExistingCourseAssignment {
  readonly annualObservationId: string;
  readonly courseOfferingId: string;
}

export type CourseAssignmentPlan =
  | {
      readonly _tag: "Reuse";
      readonly annualObservationId: string;
      readonly courseOfferingId: string;
    }
  | {
      readonly _tag: "Start";
      readonly annualObservationIds: ReadonlyArray<string>;
      readonly anchorObservationId: string;
    }
  | {
      readonly _tag: "Unresolved";
      readonly annualObservationId: string;
      readonly reason:
        | "CompetingSameYearPattern"
        | "ConflictingExistingIdentities"
        | "MissingCourseCode";
    };

export interface CourseIdentityResolution {
  readonly decisions: ReadonlyArray<CourseIdentityDecision>;
  readonly assignments: ReadonlyArray<CourseAssignmentPlan>;
}

const overlaps = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => {
  const rightValues = new Set(right);
  return left.some((value) => rightValues.has(value));
};

const competingWithinYear = (
  observations: ReadonlyArray<AnnualCourseObservation>,
  policy: CourseReconciliationPolicy,
) => {
  const competing = new Set<string>();
  for (const [index, left] of observations.entries()) {
    for (const right of observations.slice(index + 1)) {
      const corroborated =
        policy.codesCompatible(left.courseCodes, right.courseCodes) ||
        overlaps(left.activityExternalIds, right.activityExternalIds);
      if (corroborated && overlaps(left.studentExternalIds, right.studentExternalIds)) {
        competing.add(left.id);
        competing.add(right.id);
      }
    }
  }
  return competing;
};

const connectedComponents = (
  observationIds: ReadonlyArray<string>,
  decisions: ReadonlyArray<CourseIdentityDecision>,
) => {
  const neighbours = new Map(observationIds.map((id) => [id, new Set<string>()]));
  for (const decision of decisions) {
    if (decision._tag !== "Same") continue;
    neighbours.get(decision.leftObservationId)?.add(decision.rightObservationId);
    neighbours.get(decision.rightObservationId)?.add(decision.leftObservationId);
  }

  const visited = new Set<string>();
  const components: Array<ReadonlyArray<string>> = [];
  for (const id of [...observationIds].sort(Order.String)) {
    if (visited.has(id)) continue;
    const pending = [id];
    const component: Array<string> = [];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      pending.push(...(neighbours.get(current) ?? []));
    }
    components.push(component.sort(Order.String));
  }
  return components;
};

/**
 * Plans stable identities without inventing IDs. `Same` components reuse at most one stored ID;
 * ambiguous evidence stays unresolved, while the caller allocates one opaque ID per `Start` plan.
 */
export const resolveCourseIdentities = (input: {
  readonly periods: ReadonlyArray<AnnualCoursePeriod>;
  readonly existingAssignments: ReadonlyArray<ExistingCourseAssignment>;
  readonly policy: CourseReconciliationPolicy;
}): CourseIdentityResolution => {
  const periods = [...input.periods].sort(
    (left, right) =>
      Order.String(left.startsOn, right.startsOn) ||
      Order.String(left.academicYearExternalId, right.academicYearExternalId),
  );
  const observations = periods.flatMap((period) => period.observations);
  const observationById = new Map(observations.map((observation) => [observation.id, observation]));
  const periodByObservationId = new Map(
    periods.flatMap((period) => period.observations.map((item) => [item.id, period] as const)),
  );
  const existingByObservationId = new Map(
    input.existingAssignments.map((assignment) => [
      assignment.annualObservationId,
      assignment.courseOfferingId,
    ]),
  );
  const decisions = periods
    .slice(1)
    .flatMap((period, index) =>
      reconcileAnnualCourseObservations(
        periods[index]?.observations ?? [],
        period.observations,
        input.policy,
      ),
    );
  const competing = new Set(
    periods.flatMap((period) => [...competingWithinYear(period.observations, input.policy)]),
  );
  const assignments: Array<CourseAssignmentPlan> = [];

  for (const component of connectedComponents(
    observations.map((item) => item.id),
    decisions,
  )) {
    const existingCourseIds = [
      ...new Set(component.flatMap((id) => existingByObservationId.get(id) ?? [])),
    ].sort(Order.String);
    if (existingCourseIds.length > 1) {
      for (const id of component) {
        const existing = existingByObservationId.get(id);
        assignments.push(
          existing === undefined
            ? {
                _tag: "Unresolved",
                annualObservationId: id,
                reason: "ConflictingExistingIdentities",
              }
            : { _tag: "Reuse", annualObservationId: id, courseOfferingId: existing },
        );
      }
      continue;
    }

    const existingCourseId = existingCourseIds[0];
    if (existingCourseId !== undefined) {
      assignments.push(
        ...component.map((annualObservationId) => ({
          _tag: "Reuse" as const,
          annualObservationId,
          courseOfferingId: existingCourseId,
        })),
      );
      continue;
    }

    const blocked = component.find((id) => competing.has(id));
    if (blocked !== undefined) {
      assignments.push(
        ...component.map((annualObservationId) => ({
          _tag: "Unresolved" as const,
          annualObservationId,
          reason: "CompetingSameYearPattern" as const,
        })),
      );
      continue;
    }

    const missingCode = component.find(
      (id) => (observationById.get(id)?.courseCodes.length ?? 0) === 0,
    );
    if (missingCode !== undefined) {
      assignments.push(
        ...component.map((annualObservationId) => ({
          _tag: "Unresolved" as const,
          annualObservationId,
          reason: "MissingCourseCode" as const,
        })),
      );
      continue;
    }

    const ordered = [...component].sort((left, right) => {
      const leftPeriod = periodByObservationId.get(left);
      const rightPeriod = periodByObservationId.get(right);
      return (
        Order.String(leftPeriod?.startsOn ?? "", rightPeriod?.startsOn ?? "") ||
        Order.String(left, right)
      );
    });
    const anchorObservationId = ordered[0];
    if (anchorObservationId !== undefined) {
      assignments.push({
        _tag: "Start",
        annualObservationIds: ordered,
        anchorObservationId,
      });
    }
  }

  return {
    decisions,
    assignments: assignments.sort((left, right) => {
      const leftId = left._tag === "Start" ? left.anchorObservationId : left.annualObservationId;
      const rightId =
        right._tag === "Start" ? right.anchorObservationId : right.annualObservationId;
      return Order.String(leftId, rightId);
    }),
  };
};
