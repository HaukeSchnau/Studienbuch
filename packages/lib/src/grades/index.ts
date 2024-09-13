export const GRADE_TYPES = ["WRITTEN", "ORAL", "MASTER"] as const;
export type GradeType = (typeof GRADE_TYPES)[number];
