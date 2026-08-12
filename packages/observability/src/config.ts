import * as Config from "effect/Config";

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
