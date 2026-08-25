import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { getPublicConfig } from "#/infra/config/public-config.ts";
import { ClientObservability } from "#/infra/observability/client-bootstrap.tsx";

import appCss from "#/styles.css?url";

export const Route = createRootRoute({
  // Public runtime configuration is loaded once here and serialized into the SSR payload, so
  // client credentials never have to be inlined into the bundle at build time.
  loader: () => getPublicConfig(),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Studienbuch",
      },
      // Colours the browser chrome on Android to match the app's green header.
      {
        name: "theme-color",
        content: "#33A42B",
      },
      {
        property: "og:site_name",
        content: "Studienbuch",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:locale",
        content: "de_DE",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/brand/icon-512.png",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/brand/icon-192.png",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const config = Route.useLoaderData();

  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClientObservability config={config} />
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
