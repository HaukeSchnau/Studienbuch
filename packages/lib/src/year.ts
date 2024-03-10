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

export const isYearActive = (year: Year) => {
  return year.graduationYear >= getMaxActiveGraduationYear();
};
