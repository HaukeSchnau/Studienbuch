import * as Effect from "effect/Effect";

export type LogEventAttributes = Readonly<Record<string, string | number | boolean>>;

const annotateEvent = <A, E, R>(
  event: string,
  attributes: LogEventAttributes,
  effect: Effect.Effect<A, E, R>,
) => effect.pipe(Effect.annotateLogs({ event, ...attributes }));

/** Emits one stable event name as both the body and a queryable log attribute. */
export const logInfoEvent = (event: string, attributes: LogEventAttributes = {}) =>
  annotateEvent(event, attributes, Effect.logInfo(event));

export const logWarningEvent = (event: string, attributes: LogEventAttributes = {}) =>
  annotateEvent(event, attributes, Effect.logWarning(event));

export const logErrorEvent = (event: string, attributes: LogEventAttributes = {}) =>
  annotateEvent(event, attributes, Effect.logError(event));
