import type { Absence } from "~/compat/mobile-v0";
import { Atom } from "effect/unstable/reactivity";

export type AbsenceSigner = "parent" | "teacher";

export interface AddAbsenceInput {
  readonly date: Date;
  readonly courseIds: string[];
  readonly reason: string;
}

export interface SignAbsenceInput {
  readonly absenceId: string;
  readonly signer: AbsenceSigner;
}

export const absencesAtom = Atom.make<Absence[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("absences:all"),
);

export const absenceIdFactoryAtom = Atom.make({
  create: () => `absence-${Date.now()}`,
}).pipe(Atom.keepAlive, Atom.withLabel("absences:id-factory"));

export const absenceSignatureFactoryAtom = Atom.make({
  create: (_signer: AbsenceSigner): string | null => null,
}).pipe(Atom.keepAlive, Atom.withLabel("absences:signature-factory"));

export const addAbsenceAtom = Atom.writable(
  () => undefined,
  (context, input: AddAbsenceInput) => {
    context.set(absencesAtom, [
      {
        id: context.get(absenceIdFactoryAtom).create(),
        date: input.date,
        courseIds: [...input.courseIds],
        reason: input.reason,
        parentSignature: null,
        teacherSignature: null,
      },
      ...context.get(absencesAtom),
    ]);
  },
).pipe(Atom.withLabel("absences:add"));

export const deleteAbsenceAtom = Atom.writable(
  () => undefined,
  (context, absenceId: string) => {
    context.set(
      absencesAtom,
      context.get(absencesAtom).filter((absence) => absence.id !== absenceId),
    );
  },
).pipe(Atom.withLabel("absences:delete"));

export const signAbsenceAtom = Atom.writable(
  () => undefined,
  (context, { absenceId, signer }: SignAbsenceInput) => {
    const signature = context.get(absenceSignatureFactoryAtom).create(signer);
    context.set(
      absencesAtom,
      context.get(absencesAtom).map((absence) =>
        absence.id === absenceId
          ? {
              ...absence,
              ...(signer === "parent"
                ? { parentSignature: signature }
                : { teacherSignature: signature }),
            }
          : absence,
      ),
    );
  },
).pipe(Atom.withLabel("absences:sign"));
