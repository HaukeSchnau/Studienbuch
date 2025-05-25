export const isArraySingleElement = <T>(
  array: T[],
): array is [NonNullable<T>] => {
  return array.length === 1 && array[0] !== undefined && array[0] !== null;
};

export type NonEmptyArray<T> = [T, ...T[]] & {
  at: (index: -1) => T;
};

export const isArrayNonEmpty = <T>(array: T[]): array is NonEmptyArray<T> => {
  return array.length > 0;
};
