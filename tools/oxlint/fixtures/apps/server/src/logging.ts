import * as Effect from "effect/Effect";

export const seeded = (school: string, count: number) =>
  // oxlint-disable-next-line studienbuch/constant-log-message -- fixture: a value in the message
  Effect.logInfo(`Seeded ${school}`).pipe(Effect.annotateLogs({ count }));

export const applied = (names: ReadonlyArray<string>) =>
  Effect.logInfo(
    // oxlint-disable-next-line studienbuch/constant-log-message -- fixture: a value in one branch
    names.length === 0 ? "Nothing to apply" : `Applied ${names.join(", ")}`,
  );

export const died = (defect: Error, mutator: string) =>
  Effect.logError("A mutator died").pipe(
    // oxlint-disable-next-line studienbuch/constant-log-message -- fixture: a stringified annotation
    Effect.annotateLogs({ mutator, defect: String(defect) }),
  );

export const quoted = (name: string) =>
  // oxlint-disable-next-line studienbuch/constant-log-message -- fixture: a concatenated message
  Effect.logWarning("A teacher is missing: " + name);

export const constant = (space: string, id: string) =>
  Effect.logWarning("A sealed row doesn't open", { space, id }).pipe(
    Effect.annotateLogs({ reason: "Malformed" }),
  );
