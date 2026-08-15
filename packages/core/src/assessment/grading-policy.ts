import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { GradeAverage, GradeValue } from "./grading";
import type { WrittenAssessment } from "./written-assessment";

export const Config = Schema.Struct({
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
export interface Config extends Schema.Schema.Type<typeof Config> {}

export class InvalidGradeValueError extends Schema.TaggedError<InvalidGradeValueError>()(
  "Assessment.InvalidGradeValue",
  { value: Schema.Finite, minimum: Schema.Finite, maximum: Schema.Finite },
) {}

export class InvalidAssessmentScopeError extends Schema.TaggedError<InvalidAssessmentScopeError>()(
  "Assessment.InvalidScope",
  { reason: Schema.Literals(["MixedStudents", "MixedCourses"]) },
) {}

export class GradeAverageOverflowError extends Schema.TaggedError<GradeAverageOverflowError>()(
  "Assessment.GradeAverageOverflow",
  {},
) {}

export interface Interface {
  readonly config: Config;
  readonly validateValue: (value: GradeValue) => Effect.Effect<void, InvalidGradeValueError>;
  readonly average: (
    assessments: ReadonlyArray<WrittenAssessment>,
  ) => Effect.Effect<
    Option.Option<GradeAverage>,
    InvalidGradeValueError | InvalidAssessmentScopeError | GradeAverageOverflowError
  >;
}

export class Service extends Context.Service<Service, Interface>()(
  "@stu/core/assessment/GradingPolicy",
) {}

export const defaultConfig = Config.make({
  minimum: 0,
  maximum: 15,
  weighting: "AssessmentWeight",
  inclusion: "ConfirmedOnly",
  rounding: { decimalPlaces: 2, mode: "Nearest" },
});

const round = (value: number, config: Config["rounding"]): number => {
  const factor = 10 ** config.decimalPlaces;
  switch (config.mode) {
    case "Nearest":
      return Math.round(value * factor) / factor;
    case "Floor":
      return Math.floor(value * factor) / factor;
    case "Ceiling":
      return Math.ceil(value * factor) / factor;
  }
};

const isConfirmed = (assessment: WrittenAssessment): boolean =>
  assessment.teacherAttestation !== undefined && assessment.learnerAcknowledgement !== undefined;

export const make = (config: Config): Interface => {
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
    const first = assessments[0];
    if (first === undefined) return Option.none<GradeAverage>();
    if (
      assessments.some((assessment) => assessment.studentMembershipId !== first.studentMembershipId)
    ) {
      return yield* new InvalidAssessmentScopeError({ reason: "MixedStudents" });
    }
    if (assessments.some((assessment) => assessment.courseOfferingId !== first.courseOfferingId)) {
      return yield* new InvalidAssessmentScopeError({ reason: "MixedCourses" });
    }

    const included = config.inclusion === "All" ? assessments : assessments.filter(isConfirmed);
    if (included.length === 0) return Option.none<GradeAverage>();

    let weightedTotal = 0;
    let totalWeight = 0;
    for (const assessment of included) {
      yield* validateValue(assessment.value);
      const weight = config.weighting === "Equal" ? 1 : assessment.weight;
      weightedTotal += assessment.value * weight;
      totalWeight += weight;
      if (!Number.isFinite(weightedTotal) || !Number.isFinite(totalWeight)) {
        return yield* new GradeAverageOverflowError();
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

  return Service.of({ config, validateValue, average });
};

export const layer = (config: Config) => Layer.succeed(Service, make(config));

export const defaultLayer = layer(defaultConfig);

export const calculateAverage = Effect.fn("Assessment.calculateAverage")(function* (
  assessments: ReadonlyArray<WrittenAssessment>,
) {
  const policy = yield* Service;
  return yield* policy.average(assessments);
});
