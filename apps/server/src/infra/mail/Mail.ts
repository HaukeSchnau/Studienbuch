import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { createTransport } from "nodemailer";
import { Database } from "../database/Database.ts";
import { MailTables } from "./MailTables.ts";

export * as Mail from "./Mail.ts";

/** One plain-text mail. Its content never reaches a log. */
export interface Message {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export class SendFailed extends Schema.TaggedError<SendFailed, { readonly brand: unique symbol }>()(
  "Mail.SendFailed",
  { cause: Schema.Defect() },
) {}

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
          .pipe(Effect.mapError((cause) => new SendFailed({ cause })));
      }),
    };
  }),
);

/** Sends over SMTP. The URL carries the credentials, as in `smtps://user:password@host:465`. */
export const layerSmtp = (url: Redacted.Redacted, from: string) =>
  Layer.effect(Service)(
    Effect.gen(function* () {
      const transport = yield* Effect.acquireRelease(
        Effect.sync(() => createTransport(Redacted.value(url))),
        (transport) => Effect.sync(() => transport.close()),
      );

      return {
        send: Effect.fn("Mail.smtp")(function* (message: Message) {
          yield* Effect.tryPromise({
            try: () => transport.sendMail({ from, ...message }),
            catch: (cause) => new SendFailed({ cause }),
          });
        }),
      };
    }),
  );

/** `MAIL_URL` decides: `capture:` keeps mail in the database, anything else is an SMTP URL. */
export const layer = Layer.unwrap(
  Effect.map(
    Config.all({ url: Config.Redacted("MAIL_URL"), from: Config.String("MAIL_FROM") }),
    ({ url, from }) => (Redacted.value(url) === "capture:" ? layerCapture : layerSmtp(url, from)),
  ),
);
