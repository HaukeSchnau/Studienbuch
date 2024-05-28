export const isArraySingleElement = <T>(array: T[]): array is [T] => {
  return array.length === 1;
};
