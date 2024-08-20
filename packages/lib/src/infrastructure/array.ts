export const isArraySingleElement = <T>(array: T[]): array is [T] => {
  return array.length === 1;
};

export const isArrayNonEmpty = <T>(array: T[]): array is [T, ...T[]] => {
  return array.length > 0;
};
