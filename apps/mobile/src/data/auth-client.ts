import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const baseURL = process.env["EXPO_PUBLIC_API_URL"];

if (baseURL === undefined || baseURL.trim() === "") {
  throw new Error("EXPO_PUBLIC_API_URL is required to initialize the mobile authentication client");
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "studienbuch",
      storagePrefix: "studienbuch",
      storage: SecureStore,
    }),
  ],
});
