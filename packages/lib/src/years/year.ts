export interface Year {
  id: number;
  name: string;
  startYear: number;
  graduationYear: number;
}

export const getMaxActiveGraduationYear = () => {
  const today = new Date();
  return today.getMonth() >= 8 ? today.getFullYear() - 1 : today.getFullYear();
};

export const isYearActive = (year: Pick<Year, "graduationYear">) => {
  return year.graduationYear >= getMaxActiveGraduationYear();
};

export const getCurrentYearNum = (year: Pick<Year, "startYear">) => {
  const today = new Date();
  if (today.getMonth() >= 8) {
    return today.getFullYear() - year.startYear + 5;
  }

  return today.getFullYear() - year.startYear - 1 + 5;
};
