export const byStart = (starts: ReadonlyArray<number>) =>
  // oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: Array#toSorted on a device
  starts.toSorted((left, right) => left - right);

// oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: Intl.Segmenter on a device
export const words = new Intl.Segmenter("de", { granularity: "word" });

// Copying first works on Hermes.
export const byEnd = (ends: ReadonlyArray<number>) => [...ends].sort((left, right) => left - right);

export const latestFirst = (starts: ReadonlyArray<number>) =>
  // oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: a computed key
  starts["toReversed"]();

// oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: a computed key off globalThis
export const segmenter = new globalThis.Intl[`Segmenter`]("de");

// oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: a read that a later `new` calls
export const Segmenter = Intl.Segmenter;

export const sorted = (starts: ReadonlyArray<number>) =>
  // oxlint-disable-next-line studienbuch/no-hermes-unsupported-apis -- fixture: a method borrowed off the prototype
  Array.prototype.toSorted.call(starts);

// A feature test only asks whether the API exists.
export const canSegment = Intl.Segmenter !== undefined;
