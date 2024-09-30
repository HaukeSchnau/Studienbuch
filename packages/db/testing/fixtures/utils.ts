export const makeId = (num: number) => {
  return num.toString(16).padStart(32, "0");
};
