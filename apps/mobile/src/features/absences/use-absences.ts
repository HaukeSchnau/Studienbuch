import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import {
  absencesAtom,
  addAbsenceAtom,
  deleteAbsenceAtom,
  signAbsenceAtom,
  type SignAbsenceInput,
} from "./absence-atoms";

export function useAbsences() {
  const absences = useAtomValue(absencesAtom);
  const addAbsence = useAtomSet(addAbsenceAtom);
  const deleteAbsence = useAtomSet(deleteAbsenceAtom);
  const writeSignAbsence = useAtomSet(signAbsenceAtom);
  const signAbsence = useCallback(
    (absenceId: string, signer: SignAbsenceInput["signer"]) =>
      writeSignAbsence({ absenceId, signer }),
    [writeSignAbsence],
  );

  return { absences, addAbsence, deleteAbsence, signAbsence };
}
