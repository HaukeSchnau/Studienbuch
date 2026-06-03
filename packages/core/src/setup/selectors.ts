import type { Semester, UserProfile } from "../school/model";
import type { SetupPath } from "./model";

export const getRequiredSetupPath = ({
  user,
  currentSemester,
  selectedCourseIdsBySemester,
}: {
  user: UserProfile;
  currentSemester: Semester | undefined;
  selectedCourseIdsBySemester: Record<string, string[]>;
}): SetupPath | null => {
  if (!user.licenseKey.trim()) {
    return "/setup/license-key";
  }
  if (!user.name.trim() || !user.yearId || !user.classId) {
    return "/setup/name-and-year";
  }
  if ((selectedCourseIdsBySemester[currentSemester?.id ?? ""] ?? []).length === 0) {
    return "/setup/class-and-courses";
  }
  return null;
};
