import { RegistryContext } from "@effect/atom-react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { siteUrl } from "#/domain-ui/brand/links.ts";
import { ErrorState, NotFound } from "#/features/errors/error-states.tsx";
import { getPublicShellState } from "#/infra/config/public-config.ts";
import type { RouterContext } from "#/infra/effect-atom/router-context.ts";
import { ClientObservability } from "#/infra/observability/client-bootstrap.tsx";

import appCss from "#/styles.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
  // Public runtime configuration and the request's cheap auth rendering hint are loaded together
  // and serialized into the SSR payload. Neither needs another request before the first paint.
  loader: () => getPublicShellState(),
  // The public site should never fall back to the framework's bare error text.
  errorComponent: ({ reset }) => <ErrorState reset={reset} />,
  notFoundComponent: () => <NotFound />,
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
      // Without these a link pasted into a staff e-mail or a class chat renders as bare text.
      {
        property: "og:image",
        content: `${siteUrl}/brand/og-image.png`,
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:alt",
        content: "Das digitale Studienbuch",
      },
      {
        name: "twitter:image",
        content: `${siteUrl}/brand/og-image.png`,
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Rounded artwork for the browser tab, square for iOS: Apple masks the touch icon itself, so
      // a pre-rounded one would be rounded twice and show its corners.
      {
        rel: "icon",
        href: "/brand/favicon-512.png",
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
  const { bundledDev, config } = Route.useLoaderData();
  const { atomRegistry } = Route.useRouteContext();

  return (
    <html lang="de">
      <head>
        <BundledDevelopmentRuntime enabled={bundledDev} />
        <HeadContent />
      </head>
      <body>
        <ClientObservability config={config} />
        <RegistryContext.Provider value={atomRegistry}>{children}</RegistryContext.Provider>
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

/**
 * Vite injects this runtime through its HTML transform, which TanStack Start's SSR shell bypasses.
 *
 * TODO: Remove this adapter once TanStack Start emits the bundled development runtime before its
 * client entry. The non-async head script intentionally matches Vite's own bundled-dev transform.
 */
function BundledDevelopmentRuntime({ enabled }: { readonly enabled: boolean }) {
  return enabled ? <script src="/bundledDevClient.mjs" type="module" /> : null;
}
