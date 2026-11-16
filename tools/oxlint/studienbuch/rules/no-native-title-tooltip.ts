import { defineRule } from "@oxlint/plugins";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). T3 points at its Tooltip component; we have none, so the text goes on screen instead.

const INTRINSIC_ELEMENT = /^[a-z]/u;

// On these elements `title` names the embedded content for assistive technology rather than
// showing a tooltip, so it stays allowed.
const TITLE_IS_AN_ACCESSIBLE_NAME = new Set(["embed", "frame", "iframe", "math", "object"]);

/** A hint that only a hovering mouse can see is a hint most of our users never get. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the native title attribute as a tooltip on intrinsic elements.",
    },
    messages: {
      nativeTitle:
        "Don't use the native `title` tooltip. It shows only to a hovering mouse, never on touch, so put the text on screen, or give a control its name with `aria-label`.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;

        const element = node.name.name;

        if (!INTRINSIC_ELEMENT.test(element) || TITLE_IS_AN_ACCESSIBLE_NAME.has(element)) return;

        for (const attribute of node.attributes) {
          if (
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "title"
          ) {
            context.report({ node: attribute, messageId: "nativeTitle" });
          }
        }
      },
    };
  },
});
