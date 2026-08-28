import {
  logErrorEvent,
  smtpDeliveries,
  smtpDeliveryDuration,
  spanAttributes,
} from "@stu/observability";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import {
  PasswordResetEmail,
  passwordResetEmailSubject,
} from "#/features/auth/emails/password-reset.tsx";
import {
  VerificationEmail,
  verificationEmailSubject,
} from "#/features/auth/emails/verification.tsx";
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
  readonly html: string;
  readonly text: string;
}

/**
 * Renders one auth email into its deliverable form. The templates are the single source of the
 * copy; the plain-text variant is derived from the same tree so the two cannot drift apart.
 */
const renderMessage = (
  kind: Message["kind"],
  data: { readonly user: { readonly email: string }; readonly url: string },
) =>
  Effect.gen(function* () {
    const email =
      kind === "verification" ? (
        <VerificationEmail recipient={data.user.email} url={data.url} />
      ) : (
        <PasswordResetEmail recipient={data.user.email} url={data.url} />
      );
    const subject = kind === "verification" ? verificationEmailSubject : passwordResetEmailSubject;
    const html = yield* Effect.promise(() => render(email));
    const text = yield* Effect.promise(() => render(email, { plainText: true }));
    return {
      kind,
      to: data.user.email,
      subject,
      html,
      text,
    } satisfies Message;
  });

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
      const deliver: (message: Message) => Effect.Effect<void, DeliveryUnavailable> =
        mode === "console"
          ? (message) =>
              // This is intentionally not an Effect log: the local verification URL is useful to
              // a developer, but credentials and addresses must not enter OTLP.
              Console.log(`[auth-email:${message.kind}]\n${message.text}`)
          : yield* makeSmtpDelivery;

      return AuthEmail.of({
        sendVerificationEmail: (data) =>
          renderMessage("verification", data).pipe(Effect.flatMap(deliver)),
        sendPasswordResetEmail: (data) =>
          renderMessage("password-reset", data).pipe(Effect.flatMap(deliver)),
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
