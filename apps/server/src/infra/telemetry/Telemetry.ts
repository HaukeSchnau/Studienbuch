import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Fiber from "effect/Fiber";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Otlp from "effect/observability/Otlp";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as Predicate from "effect/Predicate";
import * as References from "effect/References";
import * as Tracer from "effect/Tracer";
import { Deployment } from "../config/Deployment.ts";

/** A code that names a kind of failure, such as SQLSTATE `23505` or Node's `ECONNREFUSED`. */
const failureCode = /^[A-Z0-9_]{2,16}$/u;

/** A Postgres constraint's name, which our migrations choose. */
const constraintName = /^[a-z0-9_]{1,63}$/u;

const frame = /^\s+at /u;

/**
 * The stack frames below a failure's message. V8 writes the message into the stack, a multi-line
 * one included, so the frames start after it; without the message in the stack there are none.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a cause holds failures of any type, and this is where they are read.
const framesOf = (failure: unknown): ReadonlyArray<string> => {
  if (!Predicate.hasProperty(failure, "stack") || !Predicate.isString(failure.stack)) return [];

  const message =
    Predicate.hasProperty(failure, "message") && Predicate.isString(failure.message)
      ? failure.message
      : "";

  const at = message === "" ? failure.stack.indexOf("\n") : failure.stack.indexOf(message);

  if (at === -1) return [];

  return failure.stack
    .slice(message === "" ? at : at + message.length)
    .split("\n")
    .filter((line) => frame.test(line));
};

/**
 * `failure` as telemetry shows it: its tag, its code and constraint, where it was raised, and the
 * same for what caused it. Its message and fields go, because a library's message can quote a
 * value, such as Postgres's detail of a unique key or a WebUntis error body.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a cause holds failures of any type, and this is where they are read.
const shown = (failure: unknown, seen: Set<unknown> = new Set()): Error => {
  seen.add(failure);

  const field = (key: string, pattern: RegExp) =>
    Predicate.hasProperty(failure, key) &&
    Predicate.isString(failure[key]) &&
    pattern.test(failure[key])
      ? [failure[key]]
      : [];

  const tag =
    Predicate.hasProperty(failure, "_tag") && Predicate.isString(failure._tag)
      ? failure._tag
      : failure instanceof Error
        ? failure.name
        : "Defect";

  const cause = Predicate.hasProperty(failure, "cause") ? failure.cause : undefined;

  const error = new Error(
    [...field("code", failureCode), ...field("constraint", constraintName)].join(" "),
    { cause: cause === undefined || seen.has(cause) ? undefined : shown(cause, seen) },
  );

  error.name = tag;

  error.stack = [`${tag}: ${error.message}`, ...framesOf(failure)].join("\n");

  return error;
};

/** `cause` with each failure and defect as `shown`, each keeping its annotations. */
export const withoutText = <E>(cause: Cause.Cause<E>): Cause.Cause<unknown> =>
  Cause.fromReasons(
    cause.reasons.flatMap(
      (reason): ReadonlyArray<Cause.Reason<unknown>> =>
        Cause.annotate(
          reason._tag === "Fail"
            ? Cause.fail(shown(reason.error))
            : reason._tag === "Die"
              ? Cause.die(shown(reason.defect))
              : Cause.fromReasons([reason]),
          Cause.reasonAnnotations(reason),
        ).reasons,
    ),
  );

/**
 * Span attributes that hold what a client sent: a URL's query, a request's path and its user
 * agent. Requests to WebUntis keep their path, which the import chose.
 */
const dropped = (kind: Tracer.SpanKind, key: string) =>
  key === "url.query" ||
  key === "user_agent.original" ||
  (kind === "server" && (key === "url.full" || key === "url.path"));

/**
 * `fiber` as a logger sees it, with the request logger's `http.url` as the route the request
 * matched, such as `/api/auth/*`, because the path itself is whatever the client typed.
 */
const routed = (fiber: Fiber.Fiber<unknown, unknown>): Fiber.Fiber<unknown, unknown> => {
  const annotations = fiber.getRef(References.CurrentLogAnnotations);

  if (!Object.hasOwn(annotations, "http.url")) return fiber;

  const span = Context.getOrUndefined(fiber.context, Tracer.ParentSpan);
  const route = span?._tag === "Span" ? span.attributes.get("http.route") : undefined;
  const shown = { ...annotations, "http.url": Predicate.isString(route) ? route : "unmatched" };

  // A logger reads the fiber's annotations through `getRef`; everything else stays the fiber's.
  return Object.create(fiber, {
    getRef: {
      value: <A>(reference: Context.Reference<A>) =>
        reference === References.CurrentLogAnnotations ? shown : fiber.getRef(reference),
    },
  });
};

/** A logged value with a cause or an error in it as `withoutText` and `shown` leave them. */
const textlessPart = <A>(part: A) =>
  Cause.isCause(part) ? withoutText(part) : part instanceof Error ? shown(part) : part;

/**
 * Wraps the current loggers and tracer, so that what they write holds no free text from a failure:
 * a cause, an error logged as a value, a failed span's exit and a URL's query. Messages and
 * annotations stay as the call site wrote them; `studienbuch/constant-log-message` keeps values
 * out of them.
 */
export const textless = Layer.effectContext(
  Effect.gen(function* () {
    const loggers = yield* Logger.CurrentLoggers;
    const tracer = yield* Tracer.Tracer;

    const wrapped = new Set(
      [...loggers].map((logger) =>
        Logger.make((options) =>
          logger.log({
            ...options,
            fiber: routed(options.fiber),
            cause: withoutText(options.cause),
            message: Array.isArray(options.message)
              ? Arr.map(options.message, textlessPart)
              : textlessPart(options.message),
          }),
        ),
      ),
    );

    const textlessTracer = Tracer.make({
      context: tracer.context,
      span: (options) => {
        const span = tracer.span(options);
        const end = span.end.bind(span);
        const set = span.attribute.bind(span);

        span.end = (endTime, exit) =>
          end(endTime, Exit.isFailure(exit) ? Exit.failCause(withoutText(exit.cause)) : exit);

        // A URL's query holds whatever a client typed.
        span.attribute = (key, value) => {
          if (dropped(options.kind, key)) return;

          set(
            key,
            key === "url.full" && Predicate.isString(value)
              ? value.replace(/[?#].*$/su, "")
              : value,
          );
        };

        return span;
      },
    });

    return Context.make(Logger.CurrentLoggers, wrapped).pipe(
      Context.add(Tracer.Tracer, textlessTracer),
    );
  }),
);

// The OpenTelemetry spec defaults each signal's exporter to `otlp`, and Effect defaults it to none.
// With the spec's default, `OTEL_EXPORTER_OTLP_ENDPOINT` alone turns export on.
const specDefaults = ConfigProvider.layerAdd(
  ConfigProvider.fromUnknown({
    OTEL_TRACES_EXPORTER: "otlp",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_METRICS_EXPORTER: "otlp",
  }),
);

const otlp = Layer.unwrap(
  Effect.map(Deployment.Current, ({ revision, environment }) =>
    Otlp.layerFromConfig({
      resource: {
        serviceName: "studienbuch-server",
        serviceVersion: revision,
        attributes: { "deployment.environment.name": environment },
      },
    }),
  ),
).pipe(Layer.provide([OtlpSerialization.layerProtobuf, FetchHttpClient.layer, specDefaults]));

/**
 * Exports traces, logs and metrics over OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and does
 * nothing otherwise, through `textless`. Closing the layer flushes what is buffered.
 */
export const layer = textless.pipe(Layer.provide(otlp));

export * as Telemetry from "./Telemetry.ts";
