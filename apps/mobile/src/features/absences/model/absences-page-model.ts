import { groupAbsencesByConfirmation, type Absence } from "@stu/core";

export const getAbsencesPageModel = ({
  absences,
  isOfAge,
}: {
  absences: Absence[];
  isOfAge: boolean;
}) => groupAbsencesByConfirmation(absences, isOfAge);
