import * as Metric from "effect/Metric";

const durationBoundariesMillis = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];

export const serverHttpRequests = Metric.counter("studienbuch_http_server_requests_total", {
  description: "First-party HTTP requests handled by stable route, method, and outcome.",
});

export const serverHttpRequestDuration = Metric.histogram(
  "studienbuch_http_server_request_duration_ms",
  {
    description: "First-party HTTP request duration in milliseconds.",
    boundaries: durationBoundariesMillis,
  },
);

export const authRequests = Metric.counter("studienbuch_auth_requests_total", {
  description: "Authentication operations by normalized operation and outcome.",
});

export const smtpDeliveries = Metric.counter("studienbuch_smtp_deliveries_total", {
  description: "Authentication email delivery attempts by outcome.",
});

export const smtpDeliveryDuration = Metric.histogram("studienbuch_smtp_delivery_duration_ms", {
  description: "Authentication email delivery duration in milliseconds.",
  boundaries: durationBoundariesMillis,
});

export const workerJobs = Metric.counter("studienbuch_worker_jobs_total", {
  description: "WebUntis polling jobs by bounded job, trigger, and outcome.",
});

export const workerJobDuration = Metric.histogram("studienbuch_worker_job_duration_ms", {
  description: "WebUntis polling job duration in milliseconds.",
  boundaries: durationBoundariesMillis,
});

export const workerLastSuccess = Metric.gauge("studienbuch_worker_last_success_unixtime", {
  description: "Unix timestamp of the latest successful WebUntis polling job.",
});
