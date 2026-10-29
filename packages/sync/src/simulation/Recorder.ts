/**
 * A Logger and a Tracer that keep, as text, every log line of a runtime and every span it ends, for
 * the leak check. Span ids count up: Effect's own come from `Math.random`, and RPC requests carry
 * them in their frames, so a seeded run would differ from its replay.
 */
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as References from "effect/References";
import * as Tracer from "effect/Tracer";

export * as Recorder from "./Recorder.ts";

// Logs and spans carry values of any shape, which no schema describes. Bytes become hex, so the
// leak check sees plaintext bytes too, and a value seen twice is written once. The replacer reads
// `this[key]`, because `JSON.stringify` has already replaced a Buffer by its `toJSON`.
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- see above */
const bytesOf = (field: unknown): Uint8Array | undefined => {
  if (field instanceof Uint8Array) return field;

  if (field instanceof ArrayBuffer) return new Uint8Array(field);

  return ArrayBuffer.isView(field)
    ? new Uint8Array(field.buffer, field.byteOffset, field.byteLength)
    : undefined;
};

const render = (value: unknown): string => {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, function (this: unknown, key: string, replaced: unknown) {
    const field = Predicate.isObject(this) ? (this as Record<string, unknown>)[key] : replaced;

    if (Predicate.isBigInt(field)) return field.toString();

    if (!Predicate.isObject(field)) return replaced;

    if (Redacted.isRedacted(field)) return "<redacted>";

    const bytes = bytesOf(field);

    if (bytes !== undefined) return `hex:${Hex.encode(bytes)}`;

    if (seen.has(field)) return "<seen>";
    seen.add(field);

    if (field instanceof Map) return Object.fromEntries(field);

    if (field instanceof Set) return [...field];

    // An error's own fields, as `Formatter.formatJson` writes them, besides its name and message.
    if (field instanceof Error) {
      return {
        ...Object.fromEntries(Object.entries(field)),
        name: field.name,
        message: field.message,
      };
    }

    return replaced;
  });
};
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type */

const id = (n: number, length: number) => n.toString(16).padStart(length, "0");

export const make = Effect.sync(() => {
  const lines: Array<string> = [];
  let spans = 0;

  // Fiber ids count across the whole process, so a replay would differ in them alone.
  const logger = Logger.map(Logger.formatStructured, (entry) => {
    lines.push(`log ${render({ ...entry, fiberId: undefined })}`);
  });

  const tracer = Tracer.make({
    span: (options) => {
      spans += 1;
      const span = new Tracer.NativeSpan(options);
      span._spanId = id(spans, 16);
      span._traceId = Option.match(options.parent, {
        onNone: () => id(spans, 32),
        onSome: (parent) => parent.traceId,
      });

      const end = span.end.bind(span);

      span.end = (endTime, exit) => {
        end(endTime, exit);
        lines.push(
          `span ${render({
            name: span.name,
            id: span.spanId,
            trace: span.traceId,
            attributes: span.attributes,
            events: span.events,
            links: span.links.map((link) => link.attributes),
            failure: Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined,
          })}`,
        );
      };

      return span;
    },
  });

  return {
    /** Everything recorded so far, one line per log entry or ended span. */
    lines: (): ReadonlyArray<string> => lines,
    /** Records a runtime's logs at every level, and its spans. */
    layer: Layer.mergeAll(
      Logger.layer([logger]),
      Layer.succeed(Tracer.Tracer)(tracer),
      Layer.succeed(References.MinimumLogLevel)("All"),
    ),
  };
});

export type Recorder = Effect.Success<typeof make>;
