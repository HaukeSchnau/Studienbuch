import { isGradeConfirmed, type Grade, type GradeType } from "~/compat/mobile-v0";
import { Atom } from "effect/unstable/reactivity";

export type GradeSigner = "parent" | "teacher";

export interface UpsertGradeInput {
  readonly courseId: string;
  readonly type: GradeType;
  readonly result: number;
  readonly date: Date;
}

export interface SignGradeInput {
  readonly gradeId: string;
  readonly signer: GradeSigner;
}

export interface RestoreLatestConfirmedGradeInput {
  readonly courseId: string;
  readonly type: GradeType;
  readonly isOfAge: boolean;
}

export const gradesAtom = Atom.make<Grade[]>([]).pipe(Atom.keepAlive, Atom.withLabel("grades:all"));

export const gradeIdFactoryAtom = Atom.make({
  create: () => `grade-${Date.now()}`,
}).pipe(Atom.keepAlive, Atom.withLabel("grades:id-factory"));

export const gradeSignatureFactoryAtom = Atom.make({
  create: (_signer: GradeSigner): string | null => null,
}).pipe(Atom.keepAlive, Atom.withLabel("grades:signature-factory"));

export const gradeClockAtom = Atom.make({
  now: () => new Date(),
}).pipe(Atom.keepAlive, Atom.withLabel("grades:clock"));

const createGrade = (id: string, input: UpsertGradeInput): Grade => ({
  id,
  courseId: input.courseId,
  type: input.type,
  result: input.result,
  date: input.date,
  teacherSignature: null,
  parentSignature: null,
});

export const upsertGradeAtom = Atom.writable(
  () => undefined,
  (context, input: UpsertGradeInput) => {
    const grades = context.get(gradesAtom);
    const existing = grades.find(
      (grade) => grade.courseId === input.courseId && grade.type === input.type,
    );

    if (input.type === "WRITTEN" || !existing) {
      context.set(gradesAtom, [
        createGrade(context.get(gradeIdFactoryAtom).create(), input),
        ...grades,
      ]);
      return;
    }

    context.set(
      gradesAtom,
      grades.map((grade) =>
        grade.id === existing.id
          ? {
              ...grade,
              result: input.result,
              date: input.date,
              teacherSignature: null,
              parentSignature: null,
            }
          : grade,
      ),
    );
  },
).pipe(Atom.withLabel("grades:upsert"));

export const signGradeAtom = Atom.writable(
  () => undefined,
  (context, { gradeId, signer }: SignGradeInput) => {
    const signature = context.get(gradeSignatureFactoryAtom).create(signer);
    context.set(
      gradesAtom,
      context.get(gradesAtom).map((grade) =>
        grade.id === gradeId
          ? {
              ...grade,
              ...(signer === "parent"
                ? { parentSignature: signature }
                : { teacherSignature: signature }),
            }
          : grade,
      ),
    );
  },
).pipe(Atom.withLabel("grades:sign"));

export const restoreLatestConfirmedGradeAtom = Atom.writable(
  () => undefined,
  (context, { courseId, type, isOfAge }: RestoreLatestConfirmedGradeInput) => {
    const grades = context.get(gradesAtom);
    const currentGrade = grades.find((grade) => grade.courseId === courseId && grade.type === type);
    const confirmedGrade = grades.find(
      (grade) =>
        grade.courseId === courseId && grade.type === type && isGradeConfirmed(grade, isOfAge),
    );

    if (!currentGrade || !confirmedGrade) {
      return;
    }

    const restoredAt = context.get(gradeClockAtom).now();
    context.set(
      gradesAtom,
      grades.map((grade) =>
        grade.id === currentGrade.id
          ? {
              ...grade,
              result: confirmedGrade.result,
              date: restoredAt,
              teacherSignature: null,
              parentSignature: null,
            }
          : grade,
      ),
    );
  },
).pipe(Atom.withLabel("grades:restore-latest-confirmed"));
