/**
 * Captures every log line and span the effects under it write, the way an exporter sees them behind
 * `Telemetry.textless`, so a test can search them for values that must never reach telemetry.
 */
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Formatter from "effect/Formatter";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Tracer from "effect/Tracer";
import { Telemetry } from "./Telemetry.ts";

export * as TelemetryTesting from "./TelemetryTesting.ts";

/** What was written so far: one entry per log line, span attribute, span event or failed span. */
export class Captured extends Context.Service<Captured, { readonly lines: Array<string> }>()(
  "TelemetryTesting.Captured",
) {}

/**
 * Replaces the loggers with one that keeps each line as `formatJson` writes it, plus the full
 * `Cause.pretty`, which also shows nested causes. Log lines still become span events.
 */
const loggers = Layer.unwrap(
  Effect.map(Captured, ({ lines }) =>
    Logger.layer(
      [
        Logger.make((options) => {
          lines.push(`log ${Logger.formatJson.log(options)}`);

          if (Cause.hasFails(options.cause) || Cause.hasDies(options.cause)) {
            lines.push(`log cause ${Cause.pretty(options.cause)}`);
          }
        }),
        Logger.tracerLogger,
      ],
      { mergeWithExisting: false },
    ),
  ),
);

/** A tracer whose spans are the native ones, and which keeps what an exporter would send. */
const tracer = Layer.effect(Tracer.Tracer)(
  Effect.map(Captured, ({ lines }) =>
    Tracer.make({
      span: (options) => {
        const span = Tracer.nativeTracer.span(options);
        const name = options.name;

        lines.push(`span ${name}`);

        const set = span.attribute.bind(span);
        const add = span.event.bind(span);
        const end = span.end.bind(span);

        span.attribute = (key, value) => {
          lines.push(`span ${name} attribute ${key}=${Formatter.format(value)}`);
          set(key, value);
        };

        span.event = (event, startTime, attributes) => {
          lines.push(`span ${name} event ${event} ${Formatter.format(attributes ?? {})}`);
          add(event, startTime, attributes);
        };

        span.end = (endTime, exit) => {
          if (Exit.isFailure(exit)) {
            lines.push(`span ${name} failed ${Cause.pretty(exit.cause)}`);

            for (const error of Cause.prettyErrors(exit.cause, { includeCauseInStack: true })) {
              lines.push(`span ${name} exception ${error.message} ${error.stack ?? ""}`);
            }
          }

          end(endTime, exit);
        };

        return span;
      },
    }),
  ),
);

/** `Telemetry.textless` over loggers and a tracer that capture into `Captured`, which it provides. */
export const layer = Telemetry.textless.pipe(
  Layer.provide(Layer.mergeAll(loggers, tracer)),
  Layer.provideMerge(Layer.sync(Captured)(() => ({ lines: [] }))),
);

/**
 * Every captured entry that holds one of `values` as a word of its own, in any case and either
 * Unicode form. A short name such as `SCO` is a word in "auf SCO", and no word in "scope".
 */
export const holding = (lines: ReadonlyArray<string>, values: ReadonlyArray<string>) => {
  const patterns = values.flatMap((value) =>
    [value.normalize("NFC"), value.normalize("NFD")].map(
      (form) =>
        [
          value,
          new RegExp(
            `(?<![\\p{L}\\p{N}])${form.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![\\p{L}\\p{M}\\p{N}])`,
            "iu",
          ),
        ] as const,
    ),
  );

  return lines.flatMap((line) => {
    const text = line.normalize("NFC");

    const found = [
      ...new Set(
        patterns.flatMap(([value, pattern]) =>
          pattern.test(text) || pattern.test(line.normalize("NFD")) ? [value] : [],
        ),
      ),
    ];

    return found.length === 0 ? [] : [`${found.join(", ")} in: ${line.slice(0, 300)}`];
  });
};
