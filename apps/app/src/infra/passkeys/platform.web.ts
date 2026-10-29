import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { CryptoSuite, Wrapper } from "@stu/e2ee";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Passkeys } from "./Passkeys.ts";

// The browser's WebAuthn through SimpleWebAuthn, which passes extensions through untouched and
// returns PRF outputs as bytes.

const bytes = (source: ArrayBuffer | ArrayBufferView | undefined) =>
  Option.map(Option.fromNullishOr(source), (value) =>
    ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice()
      : new Uint8Array(value).slice(),
  );

const descriptors = <D extends { readonly transports?: ReadonlyArray<string> | undefined }>(
  list: ReadonlyArray<D> | undefined,
) =>
  list?.map((descriptor) => ({
    ...descriptor,
    transports: descriptor.transports === undefined ? undefined : [...descriptor.transports],
  }));

export const layer = Layer.effect(Passkeys.Authenticator)(
  Effect.map(Wrapper.prfSalt, (salt) =>
    Passkeys.Authenticator.of({
      create: (options) =>
        Effect.tryPromise({
          try: () =>
            startRegistration({
              optionsJSON: {
                ...options,
                pubKeyCredParams: [...options.pubKeyCredParams],
                excludeCredentials: descriptors(options.excludeCredentials),
                extensions: { prf: { eval: { first: salt } } },
              },
            }),
          catch: Passkeys.failure,
        }).pipe(
          Effect.map(({ clientExtensionResults, response, ...credential }) => ({
            credential: { ...credential, response: { ...response }, clientExtensionResults: {} },
            prf: Passkeys.createdPrf(
              clientExtensionResults.prf?.enabled,
              bytes(clientExtensionResults.prf?.results?.first),
            ),
          })),
        ),
      get: (options) =>
        Effect.tryPromise({
          try: () =>
            startAuthentication({
              optionsJSON: {
                ...options,
                allowCredentials: descriptors(options.allowCredentials),
                extensions: { prf: { eval: { first: salt } } },
              },
            }),
          catch: Passkeys.failure,
        }).pipe(
          Effect.map(({ clientExtensionResults, response, ...credential }) => ({
            credential: { ...credential, response: { ...response }, clientExtensionResults: {} },
            prf: bytes(clientExtensionResults.prf?.results?.first),
          })),
        ),
    }),
  ),
).pipe(Layer.provide(CryptoSuite.layer));
