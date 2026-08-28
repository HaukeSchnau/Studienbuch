import { serverObservabilityLayer } from "@stu/observability/server";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Auth } from "@stu/server/auth";
import { Database } from "@stu/server/database";
import { EnquiryNotifier } from "@stu/server/enquiry";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { authOptions } from "#/infra/auth/options.server.ts";
import { AuthEmail } from "#/infra/email/auth-email.server.ts";
import { EnrollmentRateLimiter } from "#/infra/http/rate-limit.server.ts";
import { ClientTelemetry } from "#/infra/observability/client-telemetry.server.ts";

const telemetryLayer = serverObservabilityLayer({ serviceName: "studienbuch-server" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

/** The database connection shared by the web application and Better Auth. */
const databaseLayer = Database.layerConfig;

/** Better Auth, sharing the database and receiving this application's framework plugins. */
const authEmailLayer = AuthEmail.layer.pipe(Layer.provide(NodeServices.layer));

const authLayer = Layer.unwrap(authOptions.pipe(Effect.map(Auth.layer))).pipe(
  Layer.provide([authEmailLayer, databaseLayer, NodeServices.layer]),
);

/** Process-lifetime resources. Request handlers stay outside this layer so Nitro can reload them. */
export const WebApplicationLive = Layer.mergeAll(
  NodeServices.layer,
  ClientTelemetry.layer,
  EnrollmentRateLimiter.layer,
  EnquiryNotifier.layer,
  authLayer,
  databaseLayer,
).pipe(Layer.provideMerge(telemetryLayer));
