export const isArraySingleElement = <T>(
  array: T[],
): array is [NonNullable<T>] => {
  return array.length === 1 && array[0] !== undefined && array[0] !== null;
};

export const isArrayNonEmpty = <T>(array: T[]): array is [T, ...T[]] => {
  return array.length > 0;
};
