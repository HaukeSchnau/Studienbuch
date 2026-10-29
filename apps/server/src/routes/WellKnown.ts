import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import { NativeApps } from "../auth/NativeApps.ts";

/**
 * The files iOS and Android fetch from the environment's own host before they offer its passkeys
 * (and in M3 its saved Notfallkarte) inside the native apps. A wrong entry fails silently: no
 * passkey sheet, no save sheet. Both answer 200 with JSON and never redirect.
 */
export const layer = Layer.unwrap(
  Effect.map(NativeApps.config, (apps) =>
    Layer.mergeAll(
      HttpRouter.add(
        "GET",
        "/.well-known/apple-app-site-association",
        HttpServerResponse.jsonUnsafe({ webcredentials: { apps: apps.ios } }),
      ),
      HttpRouter.add(
        "GET",
        "/.well-known/assetlinks.json",
        HttpServerResponse.jsonUnsafe(
          apps.android.map((app) => ({
            relation: [
              "delegate_permission/common.handle_all_urls",
              "delegate_permission/common.get_login_creds",
            ],
            target: {
              namespace: "android_app",
              package_name: app.package,
              sha256_cert_fingerprints: app.sha256,
            },
          })),
        ),
      ),
    ),
  ),
);

export * as WellKnown from "./WellKnown.ts";
