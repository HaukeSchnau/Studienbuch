export const formatGrade = (result: number) => `${result.toFixed(1).replace(".", ",")} P`;

export const formatGradeShort = (result: number) => `${Math.round(result)}`;
