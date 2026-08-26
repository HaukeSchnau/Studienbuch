import {
  logErrorEvent,
  smtpDeliveries,
  smtpDeliveryDuration,
  spanAttributes,
} from "@stu/observability";
import nodemailer from "nodemailer";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

interface Message {
  readonly kind: "password-reset" | "verification";
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export class DeliveryUnavailable extends Schema.TaggedError<DeliveryUnavailable>()(
  "AuthEmail.DeliveryUnavailable",
  { reason: Schema.String },
) {}

export class AuthEmail extends Context.Service<
  AuthEmail,
  {
    readonly sendVerificationEmail: (data: {
      readonly user: { readonly email: string };
      readonly url: string;
    }) => Effect.Effect<void, DeliveryUnavailable>;
    readonly sendPasswordResetEmail: (data: {
      readonly user: { readonly email: string };
      readonly url: string;
    }) => Effect.Effect<void, DeliveryUnavailable>;
  }
>()("@stu/web/infra/email/auth-email.server/AuthEmail") {
  static readonly layer = Layer.effect(
    AuthEmail,
    Effect.gen(function* () {
      const nodeEnvironment = yield* Config.string("NODE_ENV").pipe(
        Config.withDefault("development"),
      );
      const mode = yield* Config.string("STUDIENBUCH_AUTH_EMAIL_MODE").pipe(
        Config.withDefault(nodeEnvironment === "production" ? "smtp" : "console"),
      );
      const deliver =
        mode === "console"
          ? (message: Message) =>
              // This is intentionally not an Effect log: the local verification URL is useful to
              // a developer, but credentials and addresses must not enter OTLP.
              Console.log(`[auth-email:${message.kind}]\n${message.text}`)
          : yield* makeSmtpDelivery;

      return AuthEmail.of({
        sendVerificationEmail: (data) =>
          deliver({
            kind: "verification",
            to: data.user.email,
            subject: "E-Mail-Adresse für Studienbuch bestätigen",
            text: `Bestätige deine E-Mail-Adresse über diesen Link:\n\n${data.url}\n\nDer Link ist eine Stunde gültig. Wenn du dich nicht bei Studienbuch angemeldet hast, kannst du diese Nachricht ignorieren.`,
          }),
        sendPasswordResetEmail: (data) =>
          deliver({
            kind: "password-reset",
            to: data.user.email,
            subject: "Studienbuch-Passwort zurücksetzen",
            text: `Setze dein Studienbuch-Passwort über diesen Link zurück:\n\n${data.url}\n\nDer Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren.`,
          }),
      });
    }),
  );
}

const makeSmtpDelivery = Effect.gen(function* () {
  const directUrl = yield* Config.redacted("STUDIENBUCH_SMTP_URL").pipe(Config.option);
  const urlFile = yield* Config.string("STUDIENBUCH_SMTP_URL_FILE").pipe(Config.option);
  const from = yield* Config.string("STUDIENBUCH_EMAIL_FROM");
  const fileSystem = yield* FileSystem.FileSystem;
  const smtpUrl = Option.isSome(directUrl)
    ? directUrl.value
    : Option.isSome(urlFile)
      ? Redacted.make((yield* fileSystem.readFileString(urlFile.value)).trim())
      : yield* Config.redacted("STUDIENBUCH_SMTP_URL");
  const transporter = yield* Effect.acquireRelease(
    Effect.sync(() => nodemailer.createTransport(Redacted.value(smtpUrl))),
    (transport) => Effect.sync(() => transport.close()),
  );
  return (message: Message) =>
    Effect.gen(function* () {
      const startedAt = yield* Clock.currentTimeMillis;
      return yield* Effect.tryPromise({
        try: () => {
          const { kind: _kind, ...mail } = message;
          return transporter.sendMail({ from, ...mail });
        },
        catch: (cause) =>
          DeliveryUnavailable.make({
            reason: cause instanceof Error ? cause.message : String(cause),
          }),
      }).pipe(
        Effect.asVoid,
        Effect.onExit((exit) => {
          const outcome = Exit.isSuccess(exit) ? "success" : "failure";
          const attributes = { "email.kind": message.kind, outcome };
          return Effect.all([
            Metric.update(Metric.withAttributes(smtpDeliveries, attributes), 1),
            Clock.currentTimeMillis.pipe(
              Effect.flatMap((endedAt) =>
                Metric.update(
                  Metric.withAttributes(smtpDeliveryDuration, attributes),
                  Math.max(0, endedAt - startedAt),
                ),
              ),
            ),
          ]).pipe(Effect.asVoid);
        }),
        Effect.tapError(() =>
          logErrorEvent("auth-email.smtp.failed", {
            email_kind: message.kind,
            outcome: "failure",
          }),
        ),
        Effect.withSpan("smtp.send", {
          kind: "client",
          attributes: spanAttributes({ "app.operation": `email.${message.kind}` }),
        }),
      );
    });
});
