export const GRADE_TYPES = ["WRITTEN", "ORAL", "MASTER"] as const;
export type GradeType = (typeof GRADE_TYPES)[number];

export interface Grade {
  date: Date;
  result: number;
  type: GradeType;
  teacherSignature: string | null;
  parentSignature: string | null;
}

export const formatGrade = (grade: number) => {
  if (Number.isNaN(grade)) {
    return "—";
  }

  const fmt = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${fmt.format(grade)} Pkt.`;
};

export const formatGradeShort = (grade: number) => {
  if (Number.isNaN(grade)) {
    return "—";
  }

  const fmt = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return fmt.format(grade);
};

export const isGradeConfirmed = (grade: Grade) => {
  return !!grade.parentSignature && !!grade.teacherSignature;
};
