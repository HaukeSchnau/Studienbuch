import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const configuredBaseURL = process.env.EXPO_PUBLIC_API_URL?.trim();
export const mobileApiBaseUrl =
  configuredBaseURL && configuredBaseURL.length > 0
    ? configuredBaseURL
    : __DEV__
      ? undefined
      : "https://studienbuch.app";

export const authClient = mobileApiBaseUrl
  ? createAuthClient({
      baseURL: mobileApiBaseUrl,
      plugins: [
        expoClient({
          scheme: "studienbuch",
          storagePrefix: "studienbuch",
          storage: SecureStore,
        }),
      ],
    })
  : undefined;

/** Fresh session material for first-party native requests; never persisted outside Better Auth. */
export const mobileSessionCookie = async (): Promise<string | undefined> => {
  const cookie = authClient?.getCookie().trim();
  return cookie === undefined || cookie.length === 0 ? undefined : cookie;
};
