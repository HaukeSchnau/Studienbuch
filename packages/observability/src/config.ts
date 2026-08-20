import * as Config from "effect/Config";
import { environmentVariables } from "./project.ts";

export const serverConfig = Config.all({
  enabled: Config.boolean(environmentVariables.otelEnabled).pipe(Config.withDefault(false)),
  endpoint: Config.url(environmentVariables.otelEndpoint).pipe(
    Config.withDefault(new URL("http://127.0.0.1:4318")),
  ),
  logLevel: Config.logLevel(environmentVariables.logLevel).pipe(Config.withDefault("Info")),
  traceLevel: Config.logLevel(environmentVariables.traceLevel).pipe(Config.withDefault("Info")),
  exportInterval: Config.duration(environmentVariables.exportInterval).pipe(
    Config.withDefault("5 seconds"),
  ),
  shutdownTimeout: Config.duration(environmentVariables.shutdownTimeout).pipe(
    Config.withDefault("3 seconds"),
  ),
});

export type ServerConfig = Config.Success<typeof serverConfig>;
