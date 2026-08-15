import { entityId } from "../internal/entity-id";

/** Stable identity of a task in a student's school notebook. */
export const SchoolTaskId = entityId("SchoolTaskId");
export type SchoolTaskId = typeof SchoolTaskId.Type;
