import { Mail as ApiMail } from "@stu/api/Mail";
import { desc } from "drizzle-orm";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { createTransport } from "nodemailer";
import { Deployment } from "../config/Deployment.ts";
import { Database } from "../database/Database.ts";
import { MailTables } from "./MailTables.ts";

export * as Mail from "./Mail.ts";

/** One plain-text mail. Its content never reaches a log. */
export interface Message {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/**
 * A mail didn't go out. It keeps only the kind of failure and the SMTP reply code, because the
 * error itself may carry the recipient or the message.
 */
export class SendFailed extends Schema.TaggedError<SendFailed, { readonly brand: unique symbol }>()(
  "Mail.SendFailed",
  { code: Schema.String, responseCode: Schema.optional(Schema.Int) },
) {}

/** `MAIL_URL=capture:` outside development and preview, where real people expect their mail. */
export class CaptureNotAllowed extends Schema.TaggedError<
  CaptureNotAllowed,
  { readonly brand: unique symbol }
>()("Mail.CaptureNotAllowed", { environment: Schema.String }) {}

// What nodemailer's errors say about themselves: `code` such as EAUTH, and the server's reply.
const decodeSmtpError = Schema.decodeUnknownOption(
  Schema.Struct({
    code: Schema.optional(Schema.String),
    responseCode: Schema.optional(Schema.Int),
  }),
);

export class Service extends Context.Service<
  Service,
  { readonly send: (message: Message) => Effect.Effect<void, SendFailed> }
>()("Mail.Service") {}

/** Keeps each mail in `captured_mail` instead of sending it. */
export const layerCapture = Layer.effect(Service)(
  Effect.gen(function* () {
    const db = yield* Database.Drizzle;

    return {
      send: Effect.fn("Mail.capture")(function* (message: Message) {
        const sentAt = DateTime.toDateUtc(yield* DateTime.now);

        yield* db
          .insert(MailTables.capturedMail)
          .values({ ...message, sentAt })
          .pipe(Effect.mapError(() => new SendFailed({ code: "capture" })));
      }),
    };
  }),
);

/** The newest captured mail first, for the console in development and preview. */
export const captured = Effect.gen(function* () {
  const { environment } = yield* Deployment.Current;

  if (!Deployment.isDevelopmentOrPreview(environment)) {
    return yield* new ApiMail.NotCaptured();
  }

  const db = yield* Database.Drizzle;

  const rows = yield* db
    .select()
    .from(MailTables.capturedMail)
    .orderBy(desc(MailTables.capturedMail.sentAt))
    .limit(50)
    .pipe(Effect.orDie);

  return rows.map(
    (row) => new ApiMail.Captured({ ...row, sentAt: DateTime.fromDateUnsafe(row.sentAt) }),
  );
});

/** How long one mail may take, every try included. A sign-up waits for its code mail. */
export const sendTimeout = Duration.seconds(10);

// RFC 5321 makes a 4yz reply transient, and a dropped connection may take the mail on a new one. A
// server that went silent stays so, and trying it again would only keep the sign-up waiting.
const isTransient = (error: SendFailed) =>
  error.responseCode === undefined
    ? error.code === "ECONNECTION" || error.code === "ESOCKET"
    : error.responseCode >= 400 && error.responseCode < 500;

/** Tries `attempt` up to three times while it fails transiently, and gives up after `sendTimeout`. */
export const retried = (attempt: Effect.Effect<void, SendFailed>) =>
  attempt.pipe(
    Effect.retry({ while: isTransient, times: 2, schedule: Schedule.exponential("500 millis") }),
    Effect.timeoutOrElse({
      duration: sendTimeout,
      orElse: () => Effect.fail(new SendFailed({ code: "timeout" })),
    }),
  );

/** Sends over SMTP. The URL carries the credentials, as in `smtps://user:password@host:465`. */
export const layerSmtp = (url: Redacted.Redacted, from: string) =>
  Layer.effect(Service)(
    Effect.gen(function* () {
      // Nodemailer waits minutes for a silent server, and keeps a socket that `retried` gave up on
      // open as long. Query parameters in the URL still override these.
      const timeout = Duration.toMillis(sendTimeout);

      const transport = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createTransport({
            url: Redacted.value(url),
            connectionTimeout: timeout,
            greetingTimeout: timeout,
            socketTimeout: timeout,
          }),
        ),
        (transport) => Effect.sync(() => transport.close()),
      );

      return {
        send: Effect.fn("Mail.smtp")(function* (message: Message) {
          yield* retried(
            Effect.tryPromise({
              try: () => transport.sendMail({ from, ...message }),
              catch: (cause) => {
                const read = Option.getOrUndefined(decodeSmtpError(cause));

                return new SendFailed({
                  code: read?.code ?? "unknown",
                  responseCode: read?.responseCode,
                });
              },
            }),
          );
        }),
      };
    }),
  );

/**
 * `MAIL_URL` decides: `capture:` keeps mail in the database, in development and preview only, and
 * anything else is an SMTP URL.
 */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const { environment } = yield* Deployment.Current;

    const { url, from } = yield* Config.all({
      url: Config.Redacted("MAIL_URL"),
      from: Config.String("MAIL_FROM"),
    });

    if (Redacted.value(url) !== "capture:") return layerSmtp(url, from);

    if (!Deployment.isDevelopmentOrPreview(environment)) {
      return yield* new CaptureNotAllowed({ environment });
    }

    return layerCapture;
  }),
);
