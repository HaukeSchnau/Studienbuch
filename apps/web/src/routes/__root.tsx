import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ReactNativeWebStyles } from "#/infra/react-native-web/ReactNativeWebStyles.tsx";
import siteCss from "#/ui/site.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "Studienbuch" },
    ],
    links: [{ rel: "stylesheet", href: siteCss }],
  }),
  shellComponent: Document,
});

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
        {/* Here rather than in `head`, which keeps one meta tag per name. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={Tokens.color.light.hero}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={Tokens.color.dark.hero}
        />
        <style dangerouslySetInnerHTML={{ __html: Theme.css }} />
        <ReactNativeWebStyles />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
