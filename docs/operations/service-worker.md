# The web app's service worker

`apps/app/public/sw.js` keeps copies of the last two releases under `/app/`, so the web app starts
without network. Browsers install a new worker when its bytes change, which the build makes happen
on every release (`apps/app/precache.mts`). A navigation asks the server first, so a deployed fix
reaches every online start without anything here.

## When a release's worker misbehaves

Deploy a release whose `sw.js` is the kill switch below. Each browser fetches it on its next
navigation, past its HTTP cache. The switch drops the worker and its copies and reloads open tabs
from the network. The data stays: the database in OPFS and the keys in IndexedDB are untouched.

```js
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith("studienbuch-app-"))
          .map((name) => caches.delete(name)),
      );
      await self.registration.unregister();

      for (const client of await self.clients.matchAll({ type: "window" })) {
        client.navigate(client.url);
      }
    })(),
  );
});
```

Without a worker the app needs the network to start, so restore the real one in the next release.
Browsers that never open the app in between keep the bad worker until they do.

## Never send `Clear-Site-Data: "storage"`

Not on `/app`, `/api` or anywhere else on the origin, and not `"*"`. It deletes OPFS and IndexedDB
along with the worker: every browser's database, including commands still waiting in the outbox,
and its keys. Those commands exist nowhere else. `"cache"` alone leaves them.
