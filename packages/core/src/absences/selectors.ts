import type { Absence } from "./model";
import { isAbsenceConfirmed } from "./policies";

export const groupAbsencesByConfirmation = (absences: Absence[], isOfAge = false) => ({
  excused: absences.filter((absence) => isAbsenceConfirmed(absence, isOfAge)),
  unexcused: absences.filter((absence) => !isAbsenceConfirmed(absence, isOfAge)),
});
