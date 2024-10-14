import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { env } from "./env";

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: "https://8ec188e783b8be7466ebb3b7e021dd06@o1058251.ingest.us.sentry.io/4508105117204480",

  spotlight: env.NODE_ENV === "development",

  integrations: [
    // Add our Profiling integration
    nodeProfilingIntegration(),
  ],

  // Add Tracing by setting tracesSampleRate
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Set sampling rate for profiling
  // This is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});
