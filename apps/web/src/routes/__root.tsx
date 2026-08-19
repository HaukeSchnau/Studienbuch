import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { getPublicConfig } from "#/lib/config/public-config.ts";
import { ClientObservability } from "#/lib/observability/client-bootstrap.tsx";
import PostHogProvider from "#/lib/posthog/provider.tsx";

import appCss from "../styles.css?url";

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
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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
        <PostHogProvider config={config}>
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
        </PostHogProvider>
        <Scripts />
      </body>
    </html>
  );
}
