import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import {
  absencesAtom,
  addAbsenceAtom,
  deleteAbsenceAtom,
  signAbsenceAtom,
  type AddAbsenceInput,
  type SignAbsenceInput,
} from "./absence-atoms";

export function useAbsences() {
  const absences = useAtomValue(absencesAtom);
  const add = useAtomSet(addAbsenceAtom);
  const deleteById = useAtomSet(deleteAbsenceAtom);
  const sign = useAtomSet(signAbsenceAtom);
  const addAbsence = useCallback((input: AddAbsenceInput) => add(input), [add]);
  const deleteAbsence = useCallback((absenceId: string) => deleteById(absenceId), [deleteById]);
  const signAbsence = useCallback(
    (absenceId: string, signer: SignAbsenceInput["signer"]) => sign({ absenceId, signer }),
    [sign],
  );

  return { absences, addAbsence, deleteAbsence, signAbsence };
}
