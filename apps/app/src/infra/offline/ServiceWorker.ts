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
    // After the page's own files, so the worker's download of the release doesn't compete with them.
    // Its scope is `/app` rather than `/app/`, which the server allows, so it answers a bare `/app`
    // without network too. Earlier builds registered `/app/`, which would keep answering for it.
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: base })
        .then(() => navigator.serviceWorker.getRegistrations())
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) => registration.scope.endsWith(`${base}/`))
              .map((registration) => registration.unregister()),
          ),
        )
        .catch(() => console.warn("No service worker, so the app won't start offline"));
    });

    return;
  }

  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    );
};
