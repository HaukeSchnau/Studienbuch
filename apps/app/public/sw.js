// Keeps copies of the last two releases under /app/: a start without network opens the newest,
// and a tab still running the one before keeps loading its chunks after a deploy. The build
// writes the release's files over the placeholder (precache.mts), so each release changes these
// bytes and the browser installs its worker. Without that step the worker does nothing.
const release = "__PRECACHE__";

const prefix = "studienbuch-app-";
const patience = 3000;

const built = release instanceof Object;

// The scope is `/app`, so a bare `/app` starts offline too (ServiceWorker.ts).
const base = new URL(self.registration.scope).pathname.replace(/\/$/u, "");
const root = new URL(`${base}/`, self.location.origin);
const shell = new URL("index.html", root).href;

const isOurs = (url) => {
  const { origin, pathname } = new URL(url);

  return origin === self.location.origin && (pathname === base || pathname.startsWith(`${base}/`));
};

// One cache per release, named `<prefix><install time>-<version>`, so the names sort by age.
const releaseCaches = () =>
  caches.keys().then((names) => names.filter((name) => name.startsWith(prefix)).sort());

const ownCache = () =>
  releaseCaches().then((names) => names.find((name) => name.endsWith(`-${release.version}`)));

self.addEventListener("install", (event) => {
  if (!built) return;

  event.waitUntil(
    ownCache()
      .then(async (existing) => {
        if (existing !== undefined) return;

        const cache = await caches.open(`${prefix}${Date.now()}-${release.version}`);

        await cache.addAll(release.files.map((file) => new URL(file, root).href));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([releaseCaches(), ownCache()])
      .then(([names, own]) => {
        const others = names.filter((name) => name !== own);

        return Promise.all(others.slice(0, -1).map((name) => caches.delete(name)));
      })
      .then(() => self.clients.claim()),
  );
});

const fromCopies = async (request) => {
  for (const name of (await releaseCaches()).reverse()) {
    const copy = await (await caches.open(name)).match(request, { ignoreSearch: true });

    if (copy !== undefined) return copy;
  }

  return undefined;
};

const fromOwnCopy = async (url) => {
  const own = await ownCache();

  return own === undefined ? undefined : (await caches.open(own)).match(url);
};

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
// ETags keep fresh. Every other file is named by its content and comes from a copy.
const navigate = async (request) => {
  const copy = fromOwnCopy(shell);

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

  if (!built || request.method !== "GET" || !isOurs(request.url)) return;

  event.respondWith(
    request.mode === "navigate"
      ? navigate(request)
      : fromCopies(request).then((copy) => copy ?? fetch(request)),
  );
});
