const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const parseInteger = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = parseInteger(value);
  if (parsed === undefined || parsed <= 0) return fallback;
  return parsed;
};

const parseNonNegativeInteger = (value: string | undefined, fallback: number) => {
  const parsed = parseInteger(value);
  if (parsed === undefined || parsed < 0) return fallback;
  return parsed;
};

const parseBooleanFlag = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const defaultTimeoutMs = parsePositiveInteger(process.env.EXTERNAL_API_HTTP_TIMEOUT_MS, 10_000);
const defaultRetryAttempts = parseNonNegativeInteger(process.env.EXTERNAL_API_HTTP_RETRY_ATTEMPTS, 2);
const defaultRetryDelayMs = parsePositiveInteger(process.env.EXTERNAL_API_HTTP_RETRY_DELAY_MS, 300);
const globalObservabilityEnabled = parseBooleanFlag(process.env.EXTERNAL_API_HTTP_OBSERVABILITY);

export interface ExternalApiServiceHttpPolicy {
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  observabilityEnabled: boolean;
}

const holidaysPolicy: ExternalApiServiceHttpPolicy = {
  timeoutMs: parsePositiveInteger(process.env.EXTERNAL_API_HOLIDAYS_TIMEOUT_MS, defaultTimeoutMs),
  retryAttempts: parseNonNegativeInteger(process.env.EXTERNAL_API_HOLIDAYS_RETRY_ATTEMPTS, defaultRetryAttempts),
  retryDelayMs: parsePositiveInteger(process.env.EXTERNAL_API_HOLIDAYS_RETRY_DELAY_MS, defaultRetryDelayMs),
  observabilityEnabled: globalObservabilityEnabled,
};

const untisPolicy: ExternalApiServiceHttpPolicy = {
  timeoutMs: parsePositiveInteger(process.env.EXTERNAL_API_UNTIS_TIMEOUT_MS, defaultTimeoutMs),
  retryAttempts: parseNonNegativeInteger(process.env.EXTERNAL_API_UNTIS_RETRY_ATTEMPTS, defaultRetryAttempts),
  retryDelayMs: parsePositiveInteger(process.env.EXTERNAL_API_UNTIS_RETRY_DELAY_MS, defaultRetryDelayMs),
  observabilityEnabled: globalObservabilityEnabled || parseBooleanFlag(process.env.UNTIS_CRON_HTTP_OBSERVABILITY),
};

export const externalApiHttpConfig = {
  holidays: {
    baseUrl: trimTrailingSlash(process.env.EXTERNAL_API_HOLIDAYS_BASE_URL ?? "https://openholidaysapi.org"),
    ...holidaysPolicy,
  },
  untis: {
    legacyBaseUrl: trimTrailingSlash(process.env.EXTERNAL_API_UNTIS_LEGACY_BASE_URL ?? "https://kadmos.webuntis.com"),
    schoolSearchBaseUrl: trimTrailingSlash(
      process.env.EXTERNAL_API_UNTIS_SCHOOL_SEARCH_BASE_URL ?? "https://schoolsearch.webuntis.com",
    ),
    ...untisPolicy,
  },
} as const;
