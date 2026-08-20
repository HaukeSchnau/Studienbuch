import {
  developmentLayer,
  otlpProtobufLayer,
  productionJsonLayer,
  serverConfig,
} from "@stu/observability/server";
import { Auth, Database, Migrate } from "@stu/server";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { OtlpExporter } from "effect/unstable/observability";
import { authOptions } from "#/lib/auth/auth.ts";
import { environmentVariables, serverServiceName } from "#/project.ts";
import { ClientTelemetry } from "./client-telemetry.server.ts";

const environmentConfig = Config.string(environmentVariables.environment).pipe(
  Config.orElse(() => Config.string("NODE_ENV")),
  Config.withDefault("development"),
  Config.map((value) =>
    value === "production" || value === "staging" || value === "test" ? value : "development",
  ),
);

const telemetryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* serverConfig;
    const serviceVersion = yield* Config.string(environmentVariables.version).pipe(
      Config.withDefault("development"),
    );
    const environment = yield* environmentConfig;
    if (!config.enabled) {
      const logger =
        environment === "production"
          ? productionJsonLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel })
          : developmentLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel });
      return Layer.mergeAll(logger, OtlpExporter.layerFlusher);
    }

    return otlpProtobufLayer({
      endpoint: config.endpoint,
      resource: {
        serviceName: serverServiceName,
        serviceVersion,
        environment,
      },
      logLevel: config.logLevel,
      traceLevel: config.traceLevel,
      exportInterval: config.exportInterval,
      shutdownTimeout: config.shutdownTimeout,
    }).pipe(Layer.provide(FetchHttpClient.layer));
  }),
);

/**
 * The database, migrated to the latest revision before anything is allowed to query it. Applying
 * migrations here rather than as a separate deployment step is what keeps the Release honest: the
 * process that serves requests is the process that proved the schema matches.
 */
const databaseLayer = Layer.effectDiscard(Migrate.migrateToLatest).pipe(
  Layer.provideMerge(Database.layerConfig),
);

/** Better Auth, sharing the migrated database and receiving this application's framework plugins. */
const authLayer = Auth.layer(authOptions).pipe(Layer.provide(databaseLayer));

export const WebApplicationLive = Layer.mergeAll(
  ClientTelemetry.layer,
  authLayer,
  databaseLayer,
).pipe(Layer.provideMerge(telemetryLayer));
