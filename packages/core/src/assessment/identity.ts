import { entityId } from "../internal/entity-id";

/** Stable identity of an individually recorded written assessment. */
export const AssessmentId = entityId("AssessmentId");
export type AssessmentId = typeof AssessmentId.Type;

/** Stable identity of a learner's course-level standing aggregate. */
export const CourseStandingId = entityId("CourseStandingId");
export type CourseStandingId = typeof CourseStandingId.Type;

/** Stable identity of one immutable observation in a course standing's revision chain. */
export const StandingRevisionId = entityId("StandingRevisionId");
export type StandingRevisionId = typeof StandingRevisionId.Type;
