import { groupAbsencesByConfirmation, type Absence } from "@stu/core/compat/mobile-v0";

export const getAbsencesPageModel = ({
  absences,
  isOfAge,
}: {
  absences: Absence[];
  isOfAge: boolean;
}) => groupAbsencesByConfirmation(absences, isOfAge);
