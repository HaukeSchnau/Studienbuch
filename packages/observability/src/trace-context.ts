import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Tracer from "effect/Tracer";
import * as Headers from "effect/unstable/http/Headers";
import * as HttpTraceContext from "effect/unstable/http/HttpTraceContext";

export function externalSpanFromHeaders(input: Headers.Input): Option.Option<Tracer.ExternalSpan> {
  return HttpTraceContext.fromHeaders(Headers.fromInput(input));
}

export function withIncomingTraceContext<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  input: Headers.Input,
): Effect.Effect<A, E, R> {
  return Option.match(externalSpanFromHeaders(input), {
    onNone: () => effect,
    onSome: (span) => Effect.withParentSpan(effect, span, { captureStackTrace: false }),
  });
}

export function propagationHeaders(span: Tracer.Span): Headers.Headers {
  return HttpTraceContext.toHeaders(span);
}
