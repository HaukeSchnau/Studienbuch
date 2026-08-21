import { findCurrentSemester, getRequiredSetupPath } from "~/compat/mobile-v0";
import { useCourseSelection } from "~/features/courses";
import { useSchoolCatalog } from "~/features/organization";
import { useProfile } from "~/features/profile";

export function useRequiredSetupPath() {
  const { profile } = useProfile();
  const { semesters } = useSchoolCatalog();
  const selectedCourseIdsBySemester = useCourseSelection();

  return getRequiredSetupPath({
    user: profile,
    currentSemester: findCurrentSemester(semesters),
    selectedCourseIdsBySemester,
  });
}
