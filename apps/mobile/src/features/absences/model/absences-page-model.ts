import { groupAbsencesByConfirmation, type Absence } from "~/compat/mobile-v0";

export const getAbsencesPageModel = ({
  absences,
  isOfAge,
}: {
  absences: Absence[];
  isOfAge: boolean;
}) => groupAbsencesByConfirmation(absences, isOfAge);
