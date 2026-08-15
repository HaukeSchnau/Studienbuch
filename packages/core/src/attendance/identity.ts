import { entityId } from "../internal/entity-id";

/** Identifies one absence aggregate for a student on a school date. */
export const AbsenceCaseId = entityId("AbsenceCaseId");
export type AbsenceCaseId = typeof AbsenceCaseId.Type;

/** Identifies one lesson-specific decision within an absence case. */
export const MissedLessonId = entityId("MissedLessonId");
export type MissedLessonId = typeof MissedLessonId.Type;
