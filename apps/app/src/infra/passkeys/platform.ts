import { CryptoSuite, Wrapper } from "@stu/e2ee";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Passkey from "react-native-passkeys";

import { Passkeys } from "./Passkeys.ts";

// iOS and Android through react-native-passkeys, which takes and returns binary values as
// base64url. Nothing works without the associated domain of the server's host on iOS and the
// server's assetlinks.json on Android (design/spikes/passkey-prf.md).

const bytes = (base64url: string | undefined) =>
  Option.flatMap(Option.fromNullishOr(base64url), (value) =>
    Result.getSuccess(Base64Url.decode(value)),
  );

const transports = new Set<string>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const isTransport = (value: string): value is AuthenticatorTransport => transports.has(value);

const descriptors = <D extends { readonly transports?: ReadonlyArray<string> | undefined }>(
  list: ReadonlyArray<D> | undefined,
) =>
  list?.map((descriptor) => ({
    ...descriptor,
    transports: descriptor.transports?.filter(isTransport),
  }));

const supported = Effect.suspend(() =>
  Passkey.isSupported()
    ? Effect.void
    : Effect.fail(new Passkeys.Failed({ reason: "unsupported", detail: "react-native-passkeys" })),
);

// `null` means the platform gave no credential, as when the sheet closes without one.
const answered = <A>(answer: A | null) =>
  answer === null ? Effect.fail(new Passkeys.Cancelled()) : Effect.succeed(answer);

export const layer = Layer.effect(Passkeys.Authenticator)(
  Effect.map(Wrapper.prfSalt, (salt) =>
    Passkeys.Authenticator.of({
      create: (options) =>
        supported.pipe(
          Effect.andThen(
            Effect.tryPromise({
              try: () =>
                Passkey.create({
                  ...options,
                  pubKeyCredParams: [...options.pubKeyCredParams],
                  excludeCredentials: descriptors(options.excludeCredentials),
                  extensions: { prf: { eval: { first: Base64Url.encode(salt) } } },
                }),
              catch: Passkeys.failure,
            }),
          ),
          Effect.flatMap(answered),
          Effect.map(({ clientExtensionResults, response, ...credential }) => ({
            credential: {
              ...credential,
              response: {
                clientDataJSON: response.clientDataJSON,
                attestationObject: response.attestationObject,
                transports: response.transports,
              },
              clientExtensionResults: {},
            },
            prf: Passkeys.createdPrf(
              clientExtensionResults.prf?.enabled,
              bytes(clientExtensionResults.prf?.results?.first),
            ),
          })),
        ),
      get: (options) =>
        supported.pipe(
          Effect.andThen(
            Effect.tryPromise({
              try: () =>
                Passkey.get({
                  ...options,
                  allowCredentials: descriptors(options.allowCredentials),
                  extensions: { prf: { eval: { first: Base64Url.encode(salt) } } },
                }),
              catch: Passkeys.failure,
            }),
          ),
          Effect.flatMap(answered),
          Effect.map(({ clientExtensionResults, response, ...credential }) => ({
            credential: { ...credential, response: { ...response }, clientExtensionResults: {} },
            prf: bytes(clientExtensionResults.prf?.results?.first),
          })),
        ),
    }),
  ),
).pipe(Layer.provide(CryptoSuite.layer));
