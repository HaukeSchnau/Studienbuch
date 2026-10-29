import { Platform } from "react-native";

// The browser loads `/app` from the service worker's copy of the last build when the network is
// gone, so the app starts offline with its local data (public/sw.js). Development builds come from
// Metro and change with every save, so they run without one and remove a worker a release left.

export * as ServiceWorker from "./ServiceWorker.ts";

const base = process.env.EXPO_BASE_URL ?? "";

/** Starts the service worker of a release build in a browser. Does nothing elsewhere. */
export const register = () => {
  if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;

  if (process.env.NODE_ENV === "production") {
    void navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });

    return;
  }

  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    );
};
