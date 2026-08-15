import * as Schema from "effect/Schema";

/** Grade values are finite here; the active grading policy owns their valid scale. */
export const GradeValue = Schema.Finite.pipe(Schema.brand("GradeValue"));
export type GradeValue = typeof GradeValue.Type;

export const AssessmentWeight = Schema.Finite.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("AssessmentWeight"),
);
export type AssessmentWeight = typeof AssessmentWeight.Type;

export const GradeAverage = Schema.Struct({
  value: GradeValue,
  assessmentCount: Schema.Int.check(Schema.isGreaterThan(0)),
  totalWeight: Schema.Finite.check(Schema.isGreaterThan(0)),
});
export interface GradeAverage extends Schema.Schema.Type<typeof GradeAverage> {}
