# The Grafana dashboard and vmalert rules for the metrics in contract.json, exported by the flake as
# `lib.observability`. The fleet's observability primary calls it with its panel builders (bound to
# its data sources), `tracesDatasource` and `mkAlertRule`, and provisions the returned `dashboards`
# and `metricRuleGroups`.
{
  mkAlertRule,
  mkBarGaugePanel,
  mkDashboard,
  mkLogsPanel,
  mkQueryVariable,
  mkStatPanel,
  mkTablePanel,
  mkTextPanel,
  mkTimeSeriesPanel,
  tracesDatasource,
  ...
}:
let
  contract = builtins.fromJSON (builtins.readFile ./contract.json);
  inherit (contract) metrics;
  durationName = name: builtins.head (builtins.match "(.*)_ms" name);

  dashboard = mkDashboard {
    uid = "observability-studienbuch";
    title = "Studienbuch Operations";
    links = [
      {
        title = "Traces Drilldown";
        type = "link";
        url = "/a/grafana-exploretraces-app/explore?var-service_name=studienbuch-server";
      }
      {
        title = "Application Observability";
        type = "link";
        url = "/d/observability-applications/application-observability?var-service=studienbuch-server";
      }
      {
        title = "Tempo Explore";
        type = "link";
        url = "/explore?left=%7B%22datasource%22:%22${tracesDatasource.uid}%22%7D";
      }
    ];
    templatingList = [
      (mkQueryVariable {
        name = "environment";
        label = "Environment";
        query = "label_values(${metrics.clientCanary}, deployment_environment_name)";
        currentText = "production";
        currentValue = "production";
      })
    ];
    panels = [
      (mkTextPanel {
        id = 100;
        title = "";
        content = ''
          **Start here:** authenticate or navigate in Studienbuch, then follow the request from **HTTP and auth** into **Traces Drilldown**. The lower rows expose email, WebUntis polling, browser/mobile delivery, and privacy-safe application logs.

          Counters and histograms are first-party application signals; the general Application Observability dashboard derives rate, errors, and latency from every trace. Empty panels mean that operation has not occurred in the selected period—not that the dashboard has substituted synthetic data.
        '';
        x = 0;
        y = 0;
        h = 4;
      })
      (mkStatPanel {
        id = 1;
        title = "HTTP Requests (15m)";
        expr = ''sum(increase({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name=~"$environment"}[15m])) or vector(0)'';
        x = 0;
        y = 4;
        w = 6;
      })
      (mkStatPanel {
        id = 2;
        title = "HTTP Error Share (15m)";
        expr = ''100 * sum(increase({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name=~"$environment",outcome="failure"}[15m])) / clamp_min(sum(increase({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name=~"$environment"}[15m])), 1)'';
        x = 6;
        y = 4;
        w = 6;
        unit = "percent";
        thresholds = [
          {
            color = "green";
            value = null;
          }
          {
            color = "orange";
            value = 1;
          }
          {
            color = "red";
            value = 5;
          }
        ];
      })
      (mkStatPanel {
        id = 3;
        title = "HTTP Duration p95 (10m)";
        expr = ''histogram_quantile(0.95, sum by(le) (rate({__name__=~"${durationName metrics.serverHttpRequestDuration}_(ms|milliseconds)_bucket",deployment_environment_name=~"$environment"}[10m])))'';
        x = 12;
        y = 4;
        w = 6;
        unit = "ms";
      })
      (mkStatPanel {
        id = 4;
        title = "Firing Alerts";
        expr = ''sum(ALERTS{alertname=~"Studienbuch.*",alertstate="firing"}) or vector(0)'';
        x = 18;
        y = 4;
        w = 6;
        thresholds = [
          {
            color = "green";
            value = null;
          }
          {
            color = "red";
            value = 1;
          }
        ];
      })
      (mkTimeSeriesPanel {
        id = 5;
        title = "HTTP Rate by Route and Outcome";
        expr = ''sum by(http_route, http_method, outcome) (rate({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name=~"$environment"}[5m]))'';
        legend = "{{http_method}} {{http_route}} {{outcome}}";
        x = 0;
        y = 8;
        w = 12;
        h = 8;
        unit = "reqps";
      })
      (mkTimeSeriesPanel {
        id = 6;
        title = "Authentication Operations";
        expr = ''sum by(auth_operation, outcome) (increase({__name__=~"${metrics.authRequests}(_ratio)?",deployment_environment_name=~"$environment"}[10m]))'';
        legend = "{{auth_operation}} {{outcome}}";
        x = 12;
        y = 8;
        w = 12;
        h = 8;
      })
      (mkTimeSeriesPanel {
        id = 7;
        title = "SMTP Deliveries";
        expr = ''sum by(email_kind, outcome) (increase({__name__=~"${metrics.smtpDeliveries}(_ratio)?",deployment_environment_name=~"$environment"}[30m]))'';
        legend = "{{email_kind}} {{outcome}}";
        x = 0;
        y = 16;
        w = 8;
        h = 8;
      })
      (mkTimeSeriesPanel {
        id = 8;
        title = "SMTP Duration p95";
        expr = ''histogram_quantile(0.95, sum by(le, email_kind) (rate({__name__=~"${durationName metrics.smtpDeliveryDuration}_(ms|milliseconds)_bucket",deployment_environment_name=~"$environment"}[30m])))'';
        legend = "{{email_kind}}";
        x = 8;
        y = 16;
        w = 8;
        h = 8;
        unit = "ms";
      })
      (mkTimeSeriesPanel {
        id = 9;
        title = "WebUntis Job Outcomes";
        expr = ''sum by(job, trigger, outcome) (increase({__name__=~"${metrics.workerJobs}(_ratio)?",deployment_environment_name=~"$environment"}[1h]))'';
        legend = "{{job}} {{trigger}} {{outcome}}";
        x = 16;
        y = 16;
        w = 8;
        h = 8;
      })
      (mkBarGaugePanel {
        id = 10;
        title = "WebUntis Time Since Last Success";
        expr = ''time() - max by(job) (max_over_time({__name__=~"${metrics.workerLastSuccess}(_ratio)?",deployment_environment_name=~"$environment"}[30d]))'';
        legend = "{{job}}";
        x = 0;
        y = 24;
        w = 12;
        h = 8;
        unit = "s";
      })
      (mkTimeSeriesPanel {
        id = 11;
        title = "WebUntis Job Duration p95";
        expr = ''histogram_quantile(0.95, sum by(le, job) (rate({__name__=~"${durationName metrics.workerJobDuration}_(ms|milliseconds)_bucket",deployment_environment_name=~"$environment"}[1h])))'';
        legend = "{{job}}";
        x = 12;
        y = 24;
        w = 12;
        h = 8;
        unit = "ms";
      })
      (mkTimeSeriesPanel {
        id = 12;
        title = "Browser / Mobile Request Duration p95";
        expr = ''histogram_quantile(0.95, sum by(le, platform, outcome) (rate({__name__=~"${durationName metrics.clientRequestDuration}_(ms|milliseconds)_bucket",deployment_environment_name=~"$environment"}[10m])))'';
        legend = "{{platform}} {{outcome}}";
        x = 0;
        y = 32;
        w = 8;
        h = 8;
        unit = "ms";
      })
      (mkTimeSeriesPanel {
        id = 13;
        title = "Client Telemetry Outbox Depth";
        expr = ''max by(platform) ({__name__=~"${metrics.clientOutboxDepth}(_ratio)?",deployment_environment_name=~"$environment"})'';
        legend = "{{platform}}";
        x = 8;
        y = 32;
        w = 8;
        h = 8;
        unit = "percentunit";
      })
      (mkTimeSeriesPanel {
        id = 14;
        title = "Client Telemetry Drops";
        expr = ''sum by(platform) (increase(${metrics.clientOutboxDropped}{deployment_environment_name=~"$environment"}[15m]))'';
        legend = "{{platform}}";
        x = 16;
        y = 32;
        w = 8;
        h = 8;
      })
      (mkTablePanel {
        id = 15;
        title = "Active Studienbuch Alerts";
        expr = ''sort_desc(ALERTS{alertname=~"Studienbuch.*",alertstate=~"pending|firing"})'';
        x = 0;
        y = 40;
        w = 24;
        h = 7;
      })
      (mkLogsPanel {
        id = 16;
        title = "Privacy-Safe Application Logs";
        expr = ''service.name:~"studienbuch-.*" deployment.environment.name:~"''${environment:regex}" | sort by (_time desc) | limit 500'';
        x = 0;
        y = 47;
        h = 15;
      })
      (mkStatPanel {
        id = 17;
        title = "HTTP Availability (30d)";
        expr = "100 * studienbuch:http_availability:ratio_30d";
        x = 0;
        y = 62;
        w = 8;
        unit = "percent";
      })
      (mkStatPanel {
        id = 18;
        title = "HTTP Error Budget Remaining";
        expr = "100 * studienbuch:http_error_budget:remaining_ratio_30d";
        x = 8;
        y = 62;
        w = 8;
        unit = "percent";
        thresholds = [
          {
            color = "red";
            value = null;
          }
          {
            color = "orange";
            value = 25;
          }
          {
            color = "green";
            value = 50;
          }
        ];
      })
      (mkStatPanel {
        id = 19;
        title = "Synthetic Journey";
        expr = "max_over_time(studienbuch_synthetic_journey_success[15m]) or vector(0)";
        x = 16;
        y = 62;
        w = 8;
        thresholds = [
          {
            color = "red";
            value = null;
          }
          {
            color = "green";
            value = 1;
          }
        ];
      })
    ];
  };

  availabilityTarget = toString contract.objectives.httpAvailability;
  errorBudget = toString (1.0 - contract.objectives.httpAvailability);
  ruleGroup = {
    name = "studienbuch-application-health";
    interval = "30s";
    rules = [
      {
        record = "studienbuch:http_availability:ratio_30d";
        expr = ''1 - ((sum(increase({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name="production",availability_outcome="failure"}[30d])) or vector(0)) / clamp_min(sum(increase({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name="production",availability_outcome=~"success|failure"}[30d])), 1))'';
      }
      {
        record = "studienbuch:http_error_budget:remaining_ratio_30d";
        expr = "clamp_min(clamp_max((${errorBudget} - (1 - studienbuch:http_availability:ratio_30d)) / ${errorBudget}, 1), 0)";
      }
    ]
    ++ map (alert: mkAlertRule (alert // { labels.service = contract.namespace; })) [
      {
        alert = "StudienbuchHttpErrorRateHigh";
        expr = ''(sum(rate({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name="production",availability_outcome="failure"}[10m])) / clamp_min(sum(rate({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name="production",availability_outcome=~"success|failure"}[10m])), 0.001) > 0.05) and (sum(increase({__name__=~"${metrics.serverHttpRequests}(_ratio)?",deployment_environment_name="production",availability_outcome=~"success|failure"}[10m])) > 20)'';
        duration = "10m";
        severity = "critical";
        summary = "Studienbuch HTTP server failures exceed 5%";
        description = "More than 5% of at least 20 production requests ended in a server failure for ten minutes. Client rejections do not consume availability.";
      }
      {
        alert = "StudienbuchHttpErrorBudgetLow";
        expr = "studienbuch:http_error_budget:remaining_ratio_30d < 0.25";
        duration = "30m";
        severity = "warning";
        summary = "Studienbuch has less than 25% of its 30-day HTTP error budget left";
        description = "The 30-day HTTP availability objective is ${availabilityTarget}.";
      }
      {
        alert = "StudienbuchSmtpDeliveryFailing";
        expr = ''sum(increase({__name__=~"${metrics.smtpDeliveries}(_ratio)?",deployment_environment_name="production",outcome="failure"}[15m])) > 0'';
        duration = "1m";
        summary = "Studienbuch email delivery is failing";
        description = "At least one authentication email exhausted SMTP delivery during the last fifteen minutes.";
      }
      {
        alert = "StudienbuchWorkerJobFailing";
        expr = ''sum by(job) (increase({__name__=~"${metrics.workerJobs}(_ratio)?",deployment_environment_name="production",outcome="failure"}[30m])) > 0'';
        duration = "1m";
        summary = "Studienbuch WebUntis job {{ $labels.job }} is failing";
        description = "The worker exhausted all retries for {{ $labels.job }} during the last thirty minutes.";
      }
      {
        alert = "StudienbuchWorkerRecentTimetableStale";
        expr = ''time() - max(max_over_time({__name__=~"${metrics.workerLastSuccess}(_ratio)?",deployment_environment_name="production",job="recent-and-near-timetable"}[30d])) > 30 * 60'';
        duration = "5m";
        severity = "critical";
        summary = "Studienbuch recent timetable polling is stale";
        description = "The ten-minute timetable job has not succeeded for thirty minutes.";
      }
      {
        alert = "StudienbuchWorkerFarTimetableStale";
        expr = ''time() - max(max_over_time({__name__=~"${metrics.workerLastSuccess}(_ratio)?",deployment_environment_name="production",job="far-timetable"}[30d])) > 3 * 60 * 60'';
        duration = "10m";
        summary = "Studienbuch far timetable polling is stale";
        description = "The hourly far-timetable job has not succeeded for three hours.";
      }
      {
        alert = "StudienbuchWorkerDailyJobStale";
        expr = ''time() - max by(job) (max_over_time({__name__=~"${metrics.workerLastSuccess}(_ratio)?",deployment_environment_name="production",job=~"directory|course-rosters"}[30d])) > 36 * 60 * 60'';
        duration = "30m";
        summary = "Studienbuch daily WebUntis job {{ $labels.job }} is stale";
        description = "The daily {{ $labels.job }} job has not succeeded for thirty-six hours.";
      }
      {
        alert = "StudienbuchClientTelemetryDropping";
        expr = ''sum by(platform) (increase(${metrics.clientOutboxDropped}{deployment_environment_name="production"}[15m])) > 0'';
        duration = "1m";
        summary = "Studienbuch {{ $labels.platform }} telemetry is dropping records";
        description = "A bounded production client outbox dropped telemetry after reaching capacity.";
      }
      {
        alert = "StudienbuchTraceVolumeHigh";
        expr = ''sum(increase(traces_spanmetrics_calls_total{service=~"studienbuch-.*"}[15m])) > ${toString contract.objectives.traceSpansPer15Minutes}'';
        duration = "5m";
        summary = "Studienbuch trace volume exceeds its telemetry budget";
        description = "The application emitted more than ${toString contract.objectives.traceSpansPer15Minutes} spans in fifteen minutes. Inspect span_name before increasing the budget.";
      }
      # The fleet's synthetic journey writes studienbuch_synthetic_journey_success after requesting
      # the home page, readiness, anonymous session and canary routes every five minutes.
      {
        alert = "StudienbuchSyntheticJourneyFailing";
        expr = "absent_over_time(studienbuch_synthetic_journey_success[15m]) == 1 or max_over_time(studienbuch_synthetic_journey_success[15m]) < 1";
        duration = "2m";
        severity = "critical";
        summary = "Studienbuch synthetic journey is failing";
        description = "The public home, readiness, anonymous session, or observability canary step has failed during the last fifteen minutes.";
      }
    ];
  };
in
{
  dashboards."studienbuch-operations.json" = dashboard;
  metricRuleGroups = [ ruleGroup ];
}
