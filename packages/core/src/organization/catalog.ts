import * as Schema from "effect/Schema";
import { NonBlankText } from "../foundation/non-blank-text";
import { SchoolId, SubjectId } from "./identity";

export const School = Schema.Struct({
  id: SchoolId,
  name: NonBlankText,
});
export interface School extends Schema.Schema.Type<typeof School> {}

export const Subject = Schema.Struct({
  id: SubjectId,
  schoolId: SchoolId,
  name: NonBlankText,
  code: Schema.optional(NonBlankText),
  aliases: Schema.Array(NonBlankText),
});
export interface Subject extends Schema.Schema.Type<typeof Subject> {}

export const SubjectCatalog = Schema.Struct({
  schoolId: SchoolId,
  subjects: Schema.Array(Subject),
}).check(
  Schema.makeFilter(
    ({ schoolId, subjects }) =>
      subjects.every((subject) => subject.schoolId === schoolId) &&
      new Set(subjects.map((subject) => subject.id)).size === subjects.length,
    { expected: "a catalog of uniquely identified subjects belonging to its school" },
  ),
);
export interface SubjectCatalog extends Schema.Schema.Type<typeof SubjectCatalog> {}

/** Returns a catalog subject only when both identity and school scope match. */
export const findSubject = (catalog: SubjectCatalog, subjectId: SubjectId): Subject | undefined =>
  catalog.subjects.find(
    (subject) => subject.id === subjectId && subject.schoolId === catalog.schoolId,
  );
