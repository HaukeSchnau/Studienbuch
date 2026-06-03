import type { Absence } from "./model";

export const isAbsenceConfirmed = (absence: Absence, isOfAge = false) =>
  Boolean(absence.teacherSignature) && (isOfAge || Boolean(absence.parentSignature));
