import { serverObservabilityLayer } from "@stu/observability/server";
import { Auth, Database, EnquiryNotifier } from "@stu/server";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { authOptions } from "#/infra/auth/better-auth.ts";
import { ClientTelemetry } from "#/infra/observability/client-telemetry.server.ts";

const telemetryLayer = serverObservabilityLayer({ serviceName: "studienbuch-server" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

/** The database connection shared by the web application and Better Auth. */
const databaseLayer = Database.layerConfig;

/** Better Auth, sharing the database and receiving this application's framework plugins. */
const authLayer = Auth.layer(authOptions).pipe(Layer.provide(databaseLayer));

export const WebApplicationLive = Layer.mergeAll(
  ClientTelemetry.layer,
  EnquiryNotifier.layer,
  authLayer,
  databaseLayer,
).pipe(Layer.provideMerge(telemetryLayer));
