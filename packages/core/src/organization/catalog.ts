import * as Schema from "effect/Schema";
import { ExternalRef, NonEmptyText, SchoolId, SubjectId } from "../foundation";

export const School = Schema.Struct({
  id: SchoolId,
  name: NonEmptyText,
});
export interface School extends Schema.Schema.Type<typeof School> {}

export const Subject = Schema.Struct({
  id: SubjectId,
  schoolId: SchoolId,
  name: NonEmptyText,
  code: Schema.optionalKey(NonEmptyText),
  aliases: Schema.Array(NonEmptyText),
  externalRefs: Schema.Array(ExternalRef),
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
