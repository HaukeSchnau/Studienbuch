import * as Config from "effect/Config";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export const serverConfig = Config.all({
  enabled: Config.boolean("STUDIENBUCH_OTEL_ENABLED").pipe(Config.withDefault(false)),
  endpoint: Config.url("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
    Config.withDefault(new URL("http://127.0.0.1:4318")),
  ),
  logLevel: Config.logLevel("STUDIENBUCH_LOG_LEVEL").pipe(Config.withDefault("Info")),
  traceLevel: Config.logLevel("STUDIENBUCH_TRACE_LEVEL").pipe(Config.withDefault("Info")),
  exportInterval: Config.duration("STUDIENBUCH_OTEL_EXPORT_INTERVAL").pipe(
    Config.withDefault("5 seconds"),
  ),
  shutdownTimeout: Config.duration("STUDIENBUCH_OTEL_SHUTDOWN_TIMEOUT").pipe(
    Config.withDefault("3 seconds"),
  ),
});

export type ServerConfig = Config.Success<typeof serverConfig>;

/**
 * The deployment this process belongs to.
 *
 * `NODE_ENV` is the fallback so a process started by a framework's own tooling still reports
 * something truthful. Decoded through the literal schema rather than coerced by hand, so an
 * unrecognised value is a configuration error rather than a silent "development".
 */
const DeploymentEnvironmentSchema = Schema.Literals([
  "development",
  "test",
  "staging",
  "production",
]);

export const environmentConfig = Config.schema(
  DeploymentEnvironmentSchema,
  "STUDIENBUCH_ENVIRONMENT",
).pipe(
  Config.orElse(() => Config.schema(DeploymentEnvironmentSchema, "NODE_ENV")),
  Config.withDefault("development" as const),
);

export const serviceVersionConfig = Config.string("STUDIENBUCH_VERSION").pipe(
  Config.withDefault("development"),
);

export const serviceInstanceIdConfig = Config.string("STUDIENBUCH_INSTANCE_ID").pipe(
  Config.option,
  Config.map(Option.getOrUndefined),
);

export const revisionConfig = Config.string("STUDIENBUCH_REVISION").pipe(
  Config.option,
  Config.map(Option.getOrUndefined),
);
