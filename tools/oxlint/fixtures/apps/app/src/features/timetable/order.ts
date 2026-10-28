export const byStart = (starts: ReadonlyArray<number>) =>
  // oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: Array#toSorted on a device
  starts.toSorted((left, right) => left - right);

// oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: Intl.Segmenter on a device
export const words = new Intl.Segmenter("de", { granularity: "word" });

// Copying first works on Hermes.
export const byEnd = (ends: ReadonlyArray<number>) => [...ends].sort((left, right) => left - right);
