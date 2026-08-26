Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
vp install
vp run --filter @stu/web dev
```

# Building For Production

To build this application for production:

```bash
vp run --filter @stu/web build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
vp run --filter @stu/web test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Uninstall the packages: `vp remove --filter @stu/web @tailwindcss/vite tailwindcss`

## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
vp build
node --import .output/server/instrument.server.mjs .output/server/index.mjs
```

The build output is a self-contained Node server under `.output/`.

The repository's Nix flake exposes this production server as
`packages.projectRelease`. Its embedded Project descriptor pairs the immutable
web Release and bounded WebUntis jobs with the mutable Vite, Expo, and continuous-import
Development workloads. Deployment infrastructure supplies the public URL, listener, credentials,
job schedules, and PostgreSQL URL;
the repository runtime derives `BETTER_AUTH_URL`, `DATABASE_URL`, `HOST`, and `PORT` from that
generic context. The Release intentionally contains no Metro server or embedded database.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see https://v3.nitro.build/deploy.

## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
vp dlx shadcn@latest add button
```

## Setting up Better Auth

1. Copy `.env.example` to `.env.local`, point `DATABASE_URL` at PostgreSQL, and generate a
   `BETTER_AUTH_SECRET`:

   ```bash
   vp dlx @better-auth/cli secret
   ```

2. Apply the repository-owned Drizzle migrations:

```bash
just db-migrate
```

Better Auth uses the server runtime's scoped PostgreSQL pool. Its tables live in the same migration
history as future application tables; do not run Better Auth's independent migration command.

Regular signup is available only after reserving a school access code. Verification and password
reset messages use SMTP in production:

```bash
STUDIENBUCH_SMTP_URL=smtps://user:password@mail.example.com:465
STUDIENBUCH_EMAIL_FROM='Studienbuch <no-reply@example.com>'
```

The managed Release supplies the SMTP URL as `STUDIENBUCH_SMTP_URL_FILE`, backed by a systemd
credential. Keep the direct variable for local development only; it puts the credential in the
process environment. Production also sets `STUDIENBUCH_PASSKEY_RP_ID=studienbuch.app`, allowing a
passkey registered on `beta.studienbuch.app` to remain valid on future subdomains and the apex.

Development defaults to `STUDIENBUCH_AUTH_EMAIL_MODE=console` and prints the message and link to the
server log. Production never falls back to console delivery; missing SMTP configuration makes the
send fail visibly instead of silently creating an unreachable account.

Create the platform operator and printable school codes through the console:

```bash
project dev console operator-bootstrap --name "Hauke Schnau"
project dev console access-codes --school-id igs-lilienthal --school-name "IGS Lilienthal" \
  --kind student --count 100 --operator-user-id <operator-user-id>
```

On the production host, select the active Release explicitly:

```bash
project prod console operator-bootstrap --name "Hauke Schnau"
```

From outside a managed checkout, add `-p studienbuch`. The Project adapter supplies the database
and public URL for the selected environment, starts declared Development dependencies, and runs
production commands through the active Release user and runtime context. `just console` remains a
short alias for `project dev console`.

The first command prints a short-lived passkey setup URL. The second prints every access code once;
only hashes are stored. See [`docs/authentication.md`](../../docs/authentication.md).

## Working without PostgreSQL

The Nitro `effect-runtime` plugin terminates the server when the application runtime fails to start,
so `vp dev` crash-loops if PostgreSQL is unreachable. The public marketing pages under
`src/routes/_public.*` use no service, so set `STUDIENBUCH_WEB_SKIP_RUNTIME=1` to drop the plugin
and work on them without a database:

```bash
STUDIENBUCH_WEB_SKIP_RUNTIME=1 vp dev
```

The flag is ignored when `NODE_ENV=production`, so it cannot disable the runtime in a release.

## Local observability

The Nix development action enables OTLP and sends server traces, logs, and metrics to the receiver
selected by the Project Runtime. From the repository, `project obs status` summarizes all three
signals, `project obs traces` and `project obs logs` show recent records, and `project obs open`
prints the explorable viewer URL. Every managed development checkout gets a stable
`service.instance.id`, and `project obs` selects the current checkout automatically.

Authentication requests appear as `http GET /api/auth/*` or `http POST /api/auth/*` traces. Email
and passkey sign-in POSTs also emit a correlated `auth.request.completed` log with only the
normalized operation, outcome, and HTTP status. URLs, queries, headers, credentials, and request
bodies are deliberately excluded. Browser-initiated auth requests share one trace with the server
span after the client telemetry bootstrap has loaded.

An explicit `OTEL_EXPORTER_OTLP_ENDPOINT` takes precedence over the runtime-selected receiver, so a
standard OTLP tool can be used without changing the application. Set
`STUDIENBUCH_OTEL_ENABLED=false` to disable OTLP for one run.

## Client observability configuration

Sentry is configured from the **server's** environment, not from a `VITE_` build variable. The root
route loader reads it once per document and serializes it into the SSR payload, so a deployed
release can be pointed at a project without rebuilding, and a build machine never needs deployment
credentials.

| Variable                 | Effect                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| `STUDIENBUCH_SENTRY_DSN` | Enables browser and server crash reporting. Unset disables both. |

There is deliberately no product-analytics SDK. Sentry owns crash reporting, and Effect plus
OpenTelemetry own traces, logs, and metrics through the channel described in
`packages/observability/README.md`, whose envelope is an allowlist with no free-text field.

A general analytics SDK would have undone that. `posthog-js` enables autocapture by default with
`mask_all_text` off, so it sends the visible text of clicked elements — which in this product means
course names, grade values, teacher names, and absence reasons, for users who are largely minors.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
});
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from "@tanstack/react-start";

const getServerTime = createServerFn({
  method: "GET",
}).handler(async () => {
  return new Date().toISOString();
});

// Use in a component
function MyComponent() {
  const [time, setTime] = useState("");

  useEffect(() => {
    getServerTime().then(setTime);
  }, []);

  return <div>Server time: {time}</div>;
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: () => json({ message: "Hello, World!" }),
    },
  },
});
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/people")({
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json();
  },
  component: PeopleComponent,
});

function PeopleComponent() {
  const data = Route.useLoaderData();
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  );
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
