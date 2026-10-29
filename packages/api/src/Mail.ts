import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// The mail a development or preview server kept instead of sending (`MAIL_URL=capture:`), for the
// console, where whoever tests a sign-up reads the code.

export * as Mail from "./Mail.ts";

export class Captured extends Schema.Class<Captured, { readonly brand: unique symbol }>(
  "Mail.Captured",
)({
  id: Schema.String,
  to: Schema.String,
  subject: Schema.String,
  text: Schema.String,
  sentAt: Schema.DateTimeUtc,
}) {}

/** Beta and production send their mail and keep none. */
export class NotCaptured extends Schema.TaggedError<
  NotCaptured,
  { readonly brand: unique symbol }
>()("Mail.NotCaptured", {}) {}

/**
 * Answers without a session on purpose: the Sync Lab reads a sign-up code before any session
 * exists. That holds while development runs on localhost and previews only on the Tailnet; a
 * preview on the internet must revisit it (hosting.md, Mail).
 */
export const Rpcs = RpcGroup.make(
  Rpc.make("Mail.captured", { success: Schema.Array(Captured), error: NotCaptured }),
);
