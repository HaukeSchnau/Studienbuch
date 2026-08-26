import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { fetchWithBrowserTelemetry } from "#/infra/observability/browser-fetch.ts";

export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: fetchWithBrowserTelemetry },
  plugins: [passkeyClient()],
});
