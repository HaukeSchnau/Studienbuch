import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Option from "effect/Option";

import { Passkeys } from "../../infra/passkeys/Passkeys.ts";

// The device check of recovery.md, open risk 1 (design/spikes/passkey-prf.md): a PRF output, the
// same on every sign-in and on every device sharing the passkey? It needs no account, only the
// server's host as relying party, and shows fingerprints of outputs, never the outputs.

export * as PasskeyCheck from "./PasskeyCheck.ts";

/** The first four bytes of the output's SHA-256, enough to tell outputs apart by eye. */
const fingerprint = (output: Uint8Array) => bytesToHex(sha256(output)).slice(0, 8);

const random = (length: number) =>
  Base64Url.encode(globalThis.crypto.getRandomValues(new Uint8Array(length)));

/** What creating a test passkey said about PRF: a fingerprint, "enabled" or "none". */
export const create = Effect.gen(function* () {
  const server = yield* Ports.Server;
  const passkeys = yield* Passkeys.Authenticator;

  const created = yield* passkeys.create({
    challenge: random(32),
    rp: { id: server.origin.hostname, name: "Studienbuch" },
    user: { id: random(16), name: "Passkey-Test", displayName: "Passkey-Test" },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    attestation: "none",
  });

  return Passkeys.CreatedPrf.$match(created.prf, {
    Output: ({ output }) => fingerprint(output),
    Enabled: () => "enabled",
    Unsupported: () => "none",
  });
});

/** A sign-in with any passkey of this host: its credential id and the PRF fingerprint, if any. */
export const assert = Effect.gen(function* () {
  const server = yield* Ports.Server;
  const passkeys = yield* Passkeys.Authenticator;

  const asserted = yield* passkeys.get({
    challenge: random(32),
    rpId: server.origin.hostname,
    userVerification: "required",
  });

  return {
    credential: asserted.credential.id.slice(0, 8),
    prf: Option.getOrElse(Option.map(asserted.prf, fingerprint), () => "none"),
  };
});
