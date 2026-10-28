import { defineRule, type ESTree } from "@oxlint/plugins";

// Adapted from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3
// Tools Inc.). T3 registers each list's scroll view with its header through a prop of its own. Here
// the native stack header and the native tabs find the screen's scroll view through UIKit, which
// only works when the scroll view adjusts its insets itself.

const SCROLLERS = new Set([
  "ScrollView",
  "FlatList",
  "SectionList",
  "VirtualizedList",
  "LegendList",
  "AnimatedLegendList",
  "KeyboardAwareLegendList",
]);

/** `ScrollView` for `<ScrollView>` and `<Animated.ScrollView>`. */
function elementName(name: ESTree.JSXElementName): string | null {
  if (name.type === "JSXIdentifier") return name.name;

  return name.type === "JSXMemberExpression" ? name.property.name : null;
}

/** Whether the element has `horizontal` set to anything but a literal `false`. */
function isHorizontal(attribute: ESTree.JSXAttributeItem): boolean {
  if (
    attribute.type !== "JSXAttribute" ||
    attribute.name.type !== "JSXIdentifier" ||
    attribute.name.name !== "horizontal"
  ) {
    return false;
  }

  const { value } = attribute;

  return !(
    value?.type === "JSXExpressionContainer" &&
    value.expression.type === "Literal" &&
    value.expression.value === false
  );
}

/** A screen's vertical scroller runs under the transparent header and tab bar, which track it. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require vertical scroll views and lists in the app to set `contentInsetAdjustmentBehavior`, so the native header and tab bar track them.",
    },
    messages: {
      unregistered:
        'Pass `contentInsetAdjustmentBehavior="automatic"`, so the content scrolls under the native header and tab bar, the large title collapses and the tab bar minimizes. A list nested in another scroll view or a sheet can suppress this with a reason.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = elementName(node.name);

        if (name === null || !SCROLLERS.has(name)) return;

        const registered = node.attributes.some(
          (attribute) =>
            attribute.type === "JSXAttribute" &&
            (isHorizontal(attribute) ||
              (attribute.name.type === "JSXIdentifier" &&
                attribute.name.name === "contentInsetAdjustmentBehavior")),
        );

        if (!registered) context.report({ node, messageId: "unregistered" });
      },
    };
  },
});
