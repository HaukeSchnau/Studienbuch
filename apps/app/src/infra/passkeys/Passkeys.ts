import * as Context from "effect/Context";
import * as Data from "effect/Data";
import type * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { AuthApi } from "../auth/AuthApi.ts";

// The platform's passkey sheet, with the PRF extension (recovery.md, section 4): the browser's
// WebAuthn in `platform.web.ts`, iOS and Android through react-native-passkeys in `platform.ts`.
// Both ask for one PRF output and hand it back beside the credential. The credential the server
// sees has no extension results, so the PRF output never leaves the device.

export * as Passkeys from "./Passkeys.ts";

/** The person closed the sheet, or it timed out. Nothing changed, and the screen stays. */
export class Cancelled extends Schema.TaggedError<Cancelled, { readonly brand: unique symbol }>()(
  "Passkeys.Cancelled",
  {},
) {}

/**
 * The ceremony failed. `no-passkey`: Android found no passkey for this server on the device.
 * `no-biometrics`: iOS has no Face ID or Touch ID set up. `detail` is the platform's own.
 */
export class Failed extends Schema.TaggedError<Failed, { readonly brand: unique symbol }>()(
  "Passkeys.Failed",
  {
    reason: Schema.Literals([
      "unsupported",
      "already-registered",
      "no-passkey",
      "no-biometrics",
      "failed",
    ]),
    detail: Schema.String,
  },
) {}

/**
 * What a new passkey says about PRF. Some authenticators answer with the output at once, some
 * only say it works, so one more sign-in prompt yields it, and some have none.
 */
export type CreatedPrf = Data.TaggedEnum<{
  Output: { readonly output: Uint8Array };
  Enabled: {};
  Unsupported: {};
}>;

export const CreatedPrf = Data.taggedEnum<CreatedPrf>();

export interface Created {
  readonly credential: AuthApi.Credential;
  readonly prf: CreatedPrf;
}

export interface Asserted {
  readonly credential: AuthApi.Credential;
  /** `None` where the passkey has no PRF, such as Samsung Pass. */
  readonly prf: Option.Option<Uint8Array>;
}

export class Authenticator extends Context.Service<
  Authenticator,
  {
    /** Registers a passkey for the signed-in account, evaluating PRF on `Wrapper.prfSalt`. */
    readonly create: (
      options: AuthApi.CreationOptions,
    ) => Effect.Effect<Created, Cancelled | Failed>;
    /** Asks for any passkey of this server, with user verification and PRF on `Wrapper.prfSalt`. */
    readonly get: (options: AuthApi.RequestOptions) => Effect.Effect<Asserted, Cancelled | Failed>;
  }
>()("Passkeys.Authenticator") {}

/** A registration's PRF answer, from its `enabled` flag and first output. */
export const createdPrf = (
  enabled: boolean | undefined,
  output: Option.Option<Uint8Array>,
): CreatedPrf =>
  Option.match(output, {
    onSome: (bytes) => CreatedPrf.Output({ output: bytes }),
    onNone: () => (enabled === true ? CreatedPrf.Enabled() : CreatedPrf.Unsupported()),
  });

const PlatformError = Schema.Struct({
  name: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Struct({ name: Schema.optional(Schema.String) })),
});

const decodeOwnFields = Schema.decodeUnknownOption(PlatformError);

// DOMException keeps `name` and `message` on its prototype, out of a struct decoder's reach.
const decodeThrown = Schema.decodeUnknownOption(Schema.instanceOf(Error));

const cancelled = new Set([
  "NotAllowedError",
  "AbortError",
  "ERROR_CEREMONY_ABORTED",
  "ERR_USER_CANCELLED",
  "UserCancelled",
]);

const registered = new Set(["InvalidStateError", "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"]);

/**
 * Sorts what a platform threw. A closed sheet is `Cancelled`: NotAllowedError in browsers,
 * `ERR_USER_CANCELLED` on iOS, `UserCancelled` on Android. react-native-passkeys rejects with
 * `NoCredentials` on Android and `ERR_BIOMETRIC` on iOS for the two dead ends.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a promise's rejection is unknown; the decoders below are the parser.
export const failure = (thrown: unknown): Cancelled | Failed => {
  const own = Option.getOrElse(decodeOwnFields(thrown), (): typeof PlatformError.Type => ({}));
  const error = Option.getOrUndefined(decodeThrown(thrown));

  const names = [
    own.name,
    own.code,
    own.message,
    own.cause?.name,
    error?.name,
    error?.message,
  ].filter((name) => name !== undefined);

  const detail = names.join(": ") || "unknown";

  if (names.some((name) => cancelled.has(name))) return new Cancelled();

  if (names.includes("NotSupportedError")) return new Failed({ reason: "unsupported", detail });

  if (names.some((name) => registered.has(name))) {
    return new Failed({ reason: "already-registered", detail });
  }

  if (names.includes("NoCredentials")) return new Failed({ reason: "no-passkey", detail });

  if (names.includes("ERR_BIOMETRIC")) return new Failed({ reason: "no-biometrics", detail });

  return new Failed({ reason: "failed", detail });
};
