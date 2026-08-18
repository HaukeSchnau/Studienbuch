import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn,
  enabled: dsn !== undefined && dsn !== "",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  attachScreenshot: false,
  enableNative: true,
});

export const withMobileCrashReporting = Sentry.wrap;
