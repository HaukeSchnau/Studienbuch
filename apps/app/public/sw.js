// Keeps a copy of one release under /app/, so a start without network opens the app from it. The
// build writes the release's files over the placeholder (precache.mts), so each release changes
// these bytes and the browser installs its worker. Without that step the worker does nothing.
const release = "__PRECACHE__";

const prefix = "studienbuch-app-";
const patience = 3000;

const built = release instanceof Object;
const cacheName = built ? `${prefix}${release.version}` : "";
const scope = self.registration.scope;
const shell = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  if (!built) return;

  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(release.files.map((file) => new URL(file, scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(prefix) && name !== cacheName)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const fromCopy = (request) =>
  caches.open(cacheName).then((cache) => cache.match(request, { ignoreSearch: true }));

const withPatience = (request) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("the server keeps the page waiting")),
      patience,
    );

    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

// A navigation asks the server first, so an online start gets the release it serves, which its
// ETags keep fresh. Every other file is named by its content and comes from the copy.
const navigate = async (request) => {
  const copy = fromCopy(shell);

  try {
    const response = await withPatience(request);

    // A proxy's error page while the server restarts is worse than the last release.
    return response.status >= 500 ? ((await copy) ?? response) : response;
  } catch {
    return (await copy) ?? Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!built || request.method !== "GET" || !request.url.startsWith(scope)) return;

  event.respondWith(
    request.mode === "navigate"
      ? navigate(request)
      : fromCopy(request).then((copy) => copy ?? fetch(request)),
  );
});
