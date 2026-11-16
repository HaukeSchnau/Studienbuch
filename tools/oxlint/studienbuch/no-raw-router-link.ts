import { defineRule } from "@oxlint/plugins";

import { moduleExportName } from "./syntax.ts";

/** A link to a screen of the app goes through `RouteLink`, the one composition that works on the web. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require links to the app's screens to use RouteLink instead of expo-router's Link or an `href` on `@stu/ui/Link`.",
    },
    messages: {
      expoRouterLink:
        "Link to a screen with `RouteLink` from ui/navigation/RouteLink.tsx. expo-router's Link around a Pressable loads the whole page on the web once it gets an `onPress`, and the tab loses its state and `?device=`.",
      anchor:
        "`@stu/ui/Link` with `href` is a plain anchor, which loads the whole page on the web. Link to a screen with `RouteLink` from ui/navigation/RouteLink.tsx.",
    },
  },
  create(context) {
    // Local names bound to `@stu/ui/Link`'s `Link`.
    const textLinks = new Set<string>();

    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;

          if (moduleExportName(specifier.imported) !== "Link") continue;

          if (node.source.value === "expo-router") {
            context.report({ node: specifier, messageId: "expoRouterLink" });
          } else if (node.source.value === "@stu/ui/Link") {
            textLinks.add(specifier.local.name);
          }
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || !textLinks.has(node.name.name)) return;

        for (const attribute of node.attributes) {
          if (
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "href"
          ) {
            context.report({ node: attribute, messageId: "anchor" });
          }
        }
      },
    };
  },
});
