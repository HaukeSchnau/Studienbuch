import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { GradeAverage, GradeValue, type WrittenAssessment } from "./model";
import { isWrittenAssessmentConfirmed } from "./selectors";

export const GradingPolicyConfig = Schema.Struct({
  minimum: Schema.Finite,
  maximum: Schema.Finite,
  weighting: Schema.Literals(["AssessmentWeight", "Equal"]),
  inclusion: Schema.Literals(["ConfirmedOnly", "All"]),
  rounding: Schema.Struct({
    decimalPlaces: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 6 })),
    mode: Schema.Literals(["Nearest", "Floor", "Ceiling"]),
  }),
}).check(
  Schema.makeFilter((config) => config.minimum < config.maximum, {
    expected: "a grading policy whose minimum is below its maximum",
  }),
);
export interface GradingPolicyConfig extends Schema.Schema.Type<typeof GradingPolicyConfig> {}

export class InvalidGradeValueError extends Schema.TaggedError<InvalidGradeValueError>()(
  "Assessment.InvalidGradeValue",
  { value: Schema.Finite, minimum: Schema.Finite, maximum: Schema.Finite },
) {}

export class InvalidAssessmentWeightError extends Schema.TaggedError<InvalidAssessmentWeightError>()(
  "Assessment.InvalidWeight",
  { assessmentId: Schema.optionalKey(Schema.String), weight: Schema.Finite },
) {}

export class InvalidAssessmentScopeError extends Schema.TaggedError<InvalidAssessmentScopeError>()(
  "Assessment.InvalidScope",
  { reason: Schema.Literals(["MixedStudents", "MixedCourses", "NumericOverflow"]) },
) {}

export interface GradingPolicyService {
  readonly config: GradingPolicyConfig;
  readonly validateValue: (value: GradeValue) => Effect.Effect<void, InvalidGradeValueError>;
  readonly average: (
    assessments: ReadonlyArray<WrittenAssessment>,
  ) => Effect.Effect<
    Option.Option<GradeAverage>,
    InvalidGradeValueError | InvalidAssessmentWeightError | InvalidAssessmentScopeError
  >;
}

export class GradingPolicy extends Context.Service<GradingPolicy, GradingPolicyService>()(
  "@stu/core/assessment/GradingPolicy",
) {}

export const defaultGradingPolicyConfig = GradingPolicyConfig.make({
  minimum: 0,
  maximum: 15,
  weighting: "AssessmentWeight",
  inclusion: "ConfirmedOnly",
  rounding: { decimalPlaces: 2, mode: "Nearest" },
});

const round = (value: number, config: GradingPolicyConfig["rounding"]) => {
  const factor = 10 ** config.decimalPlaces;
  const operation =
    config.mode === "Nearest" ? Math.round : config.mode === "Floor" ? Math.floor : Math.ceil;
  return operation(value * factor) / factor;
};

export const makeGradingPolicy = (config: GradingPolicyConfig): GradingPolicyService => {
  const validateValue = Effect.fn("GradingPolicy.validateValue")(function* (value: GradeValue) {
    if (value < config.minimum || value > config.maximum) {
      return yield* new InvalidGradeValueError({
        value,
        minimum: config.minimum,
        maximum: config.maximum,
      });
    }
  });

  const average = Effect.fn("GradingPolicy.average")(function* (
    assessments: ReadonlyArray<WrittenAssessment>,
  ) {
    const included =
      config.inclusion === "All" ? assessments : assessments.filter(isWrittenAssessmentConfirmed);
    if (included.length === 0) return Option.none<GradeAverage>();

    const first = included[0];
    if (first === undefined) return Option.none<GradeAverage>();
    if (
      included.some((assessment) => assessment.studentMembershipId !== first.studentMembershipId)
    ) {
      return yield* new InvalidAssessmentScopeError({ reason: "MixedStudents" });
    }
    if (included.some((assessment) => assessment.courseOfferingId !== first.courseOfferingId)) {
      return yield* new InvalidAssessmentScopeError({ reason: "MixedCourses" });
    }

    let weightedTotal = 0;
    let totalWeight = 0;
    for (const assessment of included) {
      yield* validateValue(assessment.value);
      if (!Number.isFinite(assessment.weight) || assessment.weight <= 0) {
        return yield* new InvalidAssessmentWeightError({
          assessmentId: assessment.id,
          weight: assessment.weight,
        });
      }
      const weight = config.weighting === "Equal" ? 1 : assessment.weight;
      weightedTotal += assessment.value * weight;
      totalWeight += weight;
      if (!Number.isFinite(weightedTotal) || !Number.isFinite(totalWeight)) {
        return yield* new InvalidAssessmentScopeError({ reason: "NumericOverflow" });
      }
    }

    return Option.some(
      GradeAverage.make({
        value: GradeValue.make(round(weightedTotal / totalWeight, config.rounding)),
        assessmentCount: included.length,
        totalWeight,
      }),
    );
  });

  return GradingPolicy.of({ config, validateValue, average });
};

export const gradingPolicyLayer = (config: GradingPolicyConfig) =>
  Layer.succeed(GradingPolicy, makeGradingPolicy(config));

export const defaultGradingPolicyLayer = gradingPolicyLayer(defaultGradingPolicyConfig);

export const calculateAverage = Effect.fn("Assessment.calculateAverage")(function* (
  assessments: ReadonlyArray<WrittenAssessment>,
) {
  const policy = yield* GradingPolicy;
  return yield* policy.average(assessments);
});
