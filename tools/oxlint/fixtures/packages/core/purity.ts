// Mutators read no clock, randomness or network. The first line also proves that the Effect rules
// loaded: without them its directive goes unused, and an unused directive fails the lint.
// oxlint-disable-next-line effecttsgo/global-date -- fixture: Date.now in core
export const now = () => Date.now();

// oxlint-disable-next-line effecttsgo/global-date -- fixture: new Date() in core
export const today = () => new Date();

// oxlint-disable-next-line effecttsgo/global-random -- fixture: Math.random in core
export const roll = () => Math.random();

// oxlint-disable-next-line effecttsgo/crypto-random-uuid -- fixture: crypto.randomUUID in core
export const id = () => crypto.randomUUID();

// oxlint-disable-next-line effecttsgo/global-fetch -- fixture: fetch in core
export const load = () => fetch("/api/rows");
