import * as Config from "effect/Config";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Schema from "effect/Schema";

export * as NativeApps from "./NativeApps.ts";

/** A signing certificate's SHA-256 as `keytool` prints it: 32 hex pairs joined by colons. */
const Fingerprint = Schema.String.check(Schema.isPattern(/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/u));

/**
 * The native builds that talk to this environment. The Alchemy stack sets them per environment;
 * dev and previews are web only and leave them empty.
 */
export const Apps = Schema.Struct({
  /** App ids as Apple writes them: `<team id>.<bundle id>`. */
  ios: Schema.Array(Schema.String),
  android: Schema.Array(
    Schema.Struct({
      package: Schema.String,
      /** Every certificate that signs a build of it, such as Play's app signing key. */
      sha256: Schema.Array(Fingerprint),
    }),
  ),
});

export type Apps = typeof Apps.Type;

/** `STUDIENBUCH_NATIVE_APPS` as JSON, or no apps when it is unset. */
export const config = Config.schema(Schema.fromJsonString(Apps), "STUDIENBUCH_NATIVE_APPS").pipe(
  Config.withDefault({ ios: [], android: [] }),
);

/**
 * The origins a passkey assertion from one of the Android apps carries. iOS apps carry the web
 * origin of their associated domain, so they need none of their own.
 */
export const androidOrigins = (apps: Apps): ReadonlyArray<string> =>
  apps.android.flatMap((app) =>
    app.sha256.map((fingerprint) => {
      const certificate = Uint8Array.from(fingerprint.split(":"), (pair) =>
        Number.parseInt(pair, 16),
      );

      return `android:apk-key-hash:${Base64Url.encode(certificate)}`;
    }),
  );
