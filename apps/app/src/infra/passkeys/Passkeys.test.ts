import { assert, it } from "@effect/vitest";

import { Passkeys } from "./Passkeys.ts";

// A closed sheet leaves the screen as it was; anything else shows a sentence. Android's missing
// passkey and iOS's missing Face ID get their own, because trying again won't help.
it("tells a closed passkey sheet from a failure on every platform", () => {
  assert.deepStrictEqual(
    [
      new DOMException("The operation either timed out or was not allowed.", "NotAllowedError"),
      { code: "ERR_USER_CANCELLED", message: "User cancelled the passkey interaction" },
      { code: "Passkey Get", message: "UserCancelled" },
      {
        name: "WebAuthnError",
        code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
        cause: { name: "NotAllowedError" },
      },
      { code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" },
      { name: "NotSupportedError" },
      { code: "Passkey Get", message: "NoCredentials" },
      { code: "ERR_BIOMETRIC", message: "Biometrics must be enabled" },
      "something else",
    ].map((thrown) => {
      const failure = Passkeys.failure(thrown);

      return failure._tag === "Passkeys.Cancelled" ? "cancelled" : failure.reason;
    }),
    [
      "cancelled",
      "cancelled",
      "cancelled",
      "cancelled",
      "already-registered",
      "unsupported",
      "no-passkey",
      "no-biometrics",
      "failed",
    ],
  );
});
