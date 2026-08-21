import { useAtomValue } from "@effect/atom-react";
import { schoolClassesAtom, schoolYearsAtom, semestersAtom } from "./catalog-atoms";

export function useSchoolCatalog() {
  return {
    years: useAtomValue(schoolYearsAtom),
    classes: useAtomValue(schoolClassesAtom),
    semesters: useAtomValue(semestersAtom),
  };
}
