import * as Schema from "effect/Schema";
import { Subject, SubjectCatalog } from "../academics/model";
import { SubjectId } from "../primitives";

export const SubjectInferenceRule = Schema.Literal("CourseCodePrefix");
export type SubjectInferenceRule = typeof SubjectInferenceRule.Type;

export const SubjectResolution = Schema.TaggedUnion({
  Exact: { subjectId: SubjectId, rawLabel: Schema.String },
  Inferred: {
    subjectId: SubjectId,
    rawLabel: Schema.String,
    rule: SubjectInferenceRule,
  },
  Ambiguous: {
    candidateSubjectIds: Schema.NonEmptyArray(SubjectId),
    rawLabel: Schema.String,
  },
  Unknown: { rawLabel: Schema.String },
});
export type SubjectResolution = typeof SubjectResolution.Type;

const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");

const termsFor = (subject: Subject): ReadonlyArray<string> =>
  [subject.name, ...(subject.code === undefined ? [] : [subject.code]), ...subject.aliases]
    .map(normalize)
    .filter((term, index, all) => term.length > 0 && all.indexOf(term) === index);

const uniqueSubjectIds = (subjects: ReadonlyArray<Subject>): Array<SubjectId> =>
  [...new Set(subjects.map((subject) => subject.id))].sort();

const ambiguous = (rawLabel: string, subjects: ReadonlyArray<Subject>): SubjectResolution => {
  const ids = uniqueSubjectIds(subjects);
  const first = ids[0];
  if (first === undefined) return { _tag: "Unknown", rawLabel };
  return {
    _tag: "Ambiguous",
    candidateSubjectIds: [first, ...ids.slice(1)],
    rawLabel,
  };
};

/**
 * Resolves provider-authored labels without destroying them. Exact catalog terms win; a compact
 * term followed by a numeric course suffix (for example `IF23`) is an explicit inference.
 */
export const resolveSubject = (rawLabel: string, catalog: SubjectCatalog): SubjectResolution => {
  const label = normalize(rawLabel);
  const scopedSubjects = catalog.subjects.filter(
    (subject) => subject.schoolId === catalog.schoolId,
  );
  const exact = scopedSubjects.filter((subject) => termsFor(subject).includes(label));
  const exactSubject = exact.length === 1 ? exact[0] : undefined;
  if (exactSubject !== undefined) {
    return { _tag: "Exact", subjectId: exactSubject.id, rawLabel };
  }
  if (exact.length > 1) return ambiguous(rawLabel, exact);

  const inferred = scopedSubjects.filter((subject) =>
    termsFor(subject).some((term) => {
      if (!label.startsWith(term)) return false;
      const suffix = label.slice(term.length);
      return /^[-_ ./]*\d[\p{L}\p{N} ._/-]*$/u.test(suffix);
    }),
  );
  const inferredSubject = inferred.length === 1 ? inferred[0] : undefined;
  if (inferredSubject !== undefined) {
    return {
      _tag: "Inferred",
      subjectId: inferredSubject.id,
      rawLabel,
      rule: "CourseCodePrefix",
    };
  }
  if (inferred.length > 1) return ambiguous(rawLabel, inferred);
  return { _tag: "Unknown", rawLabel };
};
