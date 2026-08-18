import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const baseURL = process.env.EXPO_PUBLIC_API_URL?.trim();

export const authClient = baseURL
  ? createAuthClient({
      baseURL,
      plugins: [
        expoClient({
          scheme: "studienbuch",
          storagePrefix: "studienbuch",
          storage: SecureStore,
        }),
      ],
    })
  : undefined;
