{
  pkgs,
  workspace,
}:
let
  inherit (workspace.toolchain) nodejs;
  webUntisEnvironment = import ../../nix/webuntis-environment.nix;
in
{
  development.action = pkgs.writeShellApplication {
    name = "studienbuch-worker-action";
    runtimeInputs = [ nodejs ];
    text = ''
      checkout="$(project-context path checkout)"
      database_host="$(project-context endpoint database listen-host)"
      database_port="$(project-context endpoint database listen-port)"

      ${webUntisEnvironment {
        requiredSecrets = false;
        database = ''
          DATABASE_URL="postgresql://postgres@$database_host:$database_port/postgres"
          export DATABASE_URL
        '';
      }}

      configured_otlp_endpoint="$(project-context parameter observabilityOtlpEndpoint)"
      export STUDIENBUCH_OTEL_ENABLED="''${STUDIENBUCH_OTEL_ENABLED:-true}"
      export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-$configured_otlp_endpoint}"
      unset configured_otlp_endpoint
      export STUDIENBUCH_ENVIRONMENT="''${STUDIENBUCH_ENVIRONMENT:-development}"
      STUDIENBUCH_INSTANCE_ID="$(project-context instance-id 2>/dev/null || true)"
      export STUDIENBUCH_INSTANCE_ID

      exec node "$checkout/apps/worker/node_modules/tsx/dist/cli.mjs" \
        "$checkout/apps/worker/src/index.ts"
    '';
  };
}
