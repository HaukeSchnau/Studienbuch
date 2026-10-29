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
// leak check sees plaintext bytes too, and a value seen twice is written once.
/* oxlint-disable anti-slop/no-unknown-parameters -- see above */
const render = (value: unknown): string => {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_key, field: unknown) => {
    if (Predicate.isBigInt(field)) return field.toString();

    if (!Predicate.isObject(field)) return field;

    if (Redacted.isRedacted(field)) return "<redacted>";

    if (field instanceof Uint8Array) return `hex:${Hex.encode(field)}`;

    if (seen.has(field)) return "<seen>";
    seen.add(field);

    if (field instanceof Map) return Object.fromEntries(field);

    if (field instanceof Set) return [...field];

    if (field instanceof Error) return { name: field.name, message: field.message };

    return field;
  });
};
/* oxlint-enable anti-slop/no-unknown-parameters */

const id = (n: number, length: number) => n.toString(16).padStart(length, "0");

export const make = Effect.sync(() => {
  const lines: Array<string> = [];
  let spans = 0;

  const logger = Logger.map(Logger.formatStructured, (entry) => {
    lines.push(`log ${render(entry)}`);
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
