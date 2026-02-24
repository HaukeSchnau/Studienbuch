export const shouldDeleteAbsenceDayAfterRemovingCourseAbsences = (
  remainingCourseAbsences: readonly unknown[],
): boolean => remainingCourseAbsences.length === 0;
