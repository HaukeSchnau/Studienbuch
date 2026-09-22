{ pkgs, config, ... }:
let
  webUntisEnvironment = config.project.release.commands.console.environment;
  webEnvironment = {
    inherit (config.project.release.serviceEnvironment)
      BETTER_AUTH_SECRET
      STUDIENBUCH_EMAIL_FROM
      STUDIENBUCH_PASSKEY_RP_ID
      ;
  };
in
{
  project.enable = true;
  project.requirements.database.package = pkgs.postgresql_17;

  processes = {
    database.project.provides.database = { };
    web.project = {
      endpoints.web = {
        port = 3000;
        health.paths = [ "/api/health/ready" ];
      };
      environment = webEnvironment // {
        STUDIENBUCH_WEB_HOST = {
          endpoint = "web";
          field = "listen.host";
        };
        STUDIENBUCH_WEB_PORT = {
          endpoint = "web";
          field = "listen.port";
        };
        STUDIENBUCH_WEB_HOST_NAMES = {
          endpoint = "web";
          field = "hostNames";
        };
      };
    };
    mobile.project = {
      endpoints.mobile = {
        port = 8081;
        health.paths = [ "/status" ];
      };
      environment = {
        STUDIENBUCH_MOBILE_HOST = {
          endpoint = "mobile";
          field = "listen.host";
        };
        STUDIENBUCH_MOBILE_PORT = {
          endpoint = "mobile";
          field = "listen.port";
        };
        EXPO_PACKAGER_PROXY_URL = {
          endpoint = "mobile";
          field = "url";
        };
        STUDIENBUCH_MOBILE_CACHE = {
          path = "cache";
          append = "mobile";
        };
      };
    };
    worker.project = {
      lifecycle = "background";
      environment = webUntisEnvironment;
    };
  };
  tasks."studienbuch:console".project = {
    command = "console";
    environment = webUntisEnvironment;
  };
}
