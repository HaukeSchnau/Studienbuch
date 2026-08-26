import contract from "../contract.json" with { type: "json" };

/** Stable names consumed by the application and its external dashboards and alerts. */
export const observabilityContract = contract;
export const metricNames = {
  canaryTotal: "studienbuch_observability_canary_total",
  canaryDuration: "studienbuch_observability_canary_duration",
  serverHttpRequests: "studienbuch_http_server_requests_total",
  serverHttpRequestDuration: "studienbuch_http_server_request_duration_ms",
  authRequests: "studienbuch_auth_requests_total",
  smtpDeliveries: "studienbuch_smtp_deliveries_total",
  smtpDeliveryDuration: "studienbuch_smtp_delivery_duration_ms",
  workerJobs: "studienbuch_worker_jobs_total",
  workerJobDuration: "studienbuch_worker_job_duration_ms",
  workerLastSuccess: "studienbuch_worker_last_success_unixtime",
  clientCanary: "studienbuch_client_canary_total",
  clientRequestDuration: "studienbuch_client_request_duration_ms",
  clientOutboxDepth: "studienbuch_client_outbox_depth",
  clientOutboxDropped: "studienbuch_client_outbox_dropped_total",
} as const;
