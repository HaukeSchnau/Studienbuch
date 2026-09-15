{ pkgs, lib, ... }:
let
  webUntisEnvironment = {
    WEBUNTIS_SCHOOL_NAME = {
      parameter = "webUntisSchoolName";
    };
    WEBUNTIS_SCHOOL_LOGIN_NAME = {
      parameter = "webUntisSchoolLoginName";
    };
    WEBUNTIS_SERVER_URL = {
      parameter = "webUntisServerUrl";
    };
    WEBUNTIS_TENANT_ID = {
      parameter = "webUntisTenantId";
    };
    WEBUNTIS_USERNAME = {
      binding = "webUntisUsername";
      field = "value";
    };
    WEBUNTIS_PASSWORD = {
      binding = "webUntisPassword";
      field = "value";
    };
  };
  commonEnvironment = {
    DATABASE_URL = {
      binding = "database";
      field = "url";
    };
    BETTER_AUTH_URL = {
      endpoint = "web";
      field = "url";
    };
    STUDIENBUCH_INSTANCE_ID = {
      instance = "id";
    };
    STUDIENBUCH_OTEL_ENABLED = "true";
    OTEL_EXPORTER_OTLP_ENDPOINT = {
      parameter = "observabilityOtlpEndpoint";
    };
  };
  webEnvironment = {
    BETTER_AUTH_SECRET = {
      binding = "betterAuthSecret";
      field = "value";
    };
    STUDIENBUCH_EMAIL_FROM = {
      parameter = "authEmailFrom";
    };
    STUDIENBUCH_PASSKEY_RP_ID = {
      parameter = "passkeyRpId";
    };
  };
in
{
  project = {
    enable = true;
    name = "studienbuch";
    requirements = {
      database = {
        kind = "postgresql";
        package = pkgs.postgresql_17;
        majorVersions = [
          16
          17
        ];
        dataDirectory = "postgres";
      };
      betterAuthSecret = {
        kind = "secret";
        generate.bytes = 32;
      };
      smtpUrl = {
        kind = "secret";
        realizations = [ "release" ];
      };
      webUntisUsername = {
        kind = "secret";
      };
      webUntisPassword = {
        kind = "secret";
      };
    };
    parameters = {
      authEmailFrom = {
        description = "Sender shown on authentication email";
        default = "Studienbuch <konto@studienbuch.app>";
      };
      passkeyRpId = {
        description = "WebAuthn relying-party ID shared by production origins";
        default = "studienbuch.app";
      };
      webUntisSchoolName = {
        description = "Display name used to discover the WebUntis school";
        required = true;
      };
      webUntisSchoolLoginName = {
        description = "Operational WebUntis school login name";
        required = true;
      };
      webUntisServerUrl = {
        description = "Pinned WebUntis server URL";
        required = true;
      };
      webUntisTenantId = {
        description = "Pinned WebUntis tenant identity";
        required = true;
      };
      observabilityOtlpEndpoint = {
        description = "OpenTelemetry Protocol HTTP endpoint selected by the runtime";
        required = true;
      };
    };
    environment = commonEnvironment // {
      PGHOST = {
        binding = "database";
        field = "host";
      };
      PGPORT = {
        binding = "database";
        field = "port";
      };
      PGUSER = {
        binding = "database";
        field = "user";
      };
      PGDATABASE = {
        binding = "database";
        field = "database";
      };
      PGDATA = {
        binding = "database";
        field = "dataDirectory";
      };
      EXPO_PUBLIC_API_URL = {
        endpoint = "web";
        field = "url";
      };
    };
    release = {
      action = "web";
      commands = {
        console = {
          action = "console";
          secrets = [
            "webUntisUsername"
            "webUntisPassword"
          ];
        };
      };
      preDeployTasks = {
        migrate = {
          timeoutSec = 300;
        };
      };
      maintenanceJobs = {
        webuntis-directory = {
          schedule = {
            calendar = "*-*-* 03:15:00";
          };
          secrets = [
            "webUntisUsername"
            "webUntisPassword"
          ];
        };
        webuntis-timetable-hot = {
          schedule = {
            interval = "10min";
            cadence = "fixed";
          };
          secrets = [
            "webUntisUsername"
            "webUntisPassword"
          ];
        };
        webuntis-timetable-warm = {
          schedule = {
            interval = "1h";
            cadence = "fixed";
          };
          secrets = [
            "webUntisUsername"
            "webUntisPassword"
          ];
        };
        webuntis-course-rosters = {
          schedule = {
            calendar = "*-*-* 04:00:00";
          };
          secrets = [
            "webUntisUsername"
            "webUntisPassword"
          ];
        };
      };
      health = {
        paths = [
          "/api/health/live"
          "/api/health/ready"
        ];
        startupTimeoutSec = 60;
        intervalSec = 2;
        requestTimeoutSec = 2;
      };
      ingress = {
        compression = true;
      };
    };
    releaseEnvironment = {
      common = commonEnvironment // {
        STUDIENBUCH_ENVIRONMENT = "production";
      };
      actions = {
        web = webEnvironment // {
          HOST = {
            endpoint = "web";
            field = "listen.host";
          };
          PORT = {
            endpoint = "web";
            field = "listen.port";
          };
          STUDIENBUCH_SMTP_URL_FILE = {
            binding = "smtpUrl";
            field = "file";
          };
        };
        console = webUntisEnvironment;
      }
      // lib.genAttrs [
        "webuntis-directory"
        "webuntis-timetable-hot"
        "webuntis-timetable-warm"
        "webuntis-course-rosters"
      ] (_: webUntisEnvironment);
    };
  };
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
