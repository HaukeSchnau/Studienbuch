import { findCurrentSemester, getRequiredSetupPath } from "~/compat/mobile-v0";
import { useCourseSelection } from "~/features/courses";
import { useSchoolCatalog } from "~/features/organization";
import { useSessionData } from "~/infra/data/hooks";

export function useRequiredSetupPath() {
  const { user } = useSessionData();
  const { semesters } = useSchoolCatalog();
  const selectedCourseIdsBySemester = useCourseSelection();

  return getRequiredSetupPath({
    user,
    currentSemester: findCurrentSemester(semesters),
    selectedCourseIdsBySemester,
  });
}
