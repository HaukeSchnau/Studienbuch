import { defineRule } from "@oxlint/plugins";

const CHECKABLE_ROLES = new Set(["checkbox", "radio"]);

const ROLE_PROPS = new Set(["accessibilityRole", "role"]);

/** A checkbox or radio goes through `Checkable`, the one pressable that answers Space on the web. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require checkboxes and radios to use `Checkable` from @stu/ui/Checkable instead of their own role.",
    },
    messages: {
      rawCheckable:
        "Build a checkbox or radio on `Checkable` from @stu/ui/Checkable, or on Checkbox, PillChoice or TickBox. react-native-web presses only buttons with Space, so a pressable with this role ignores the key that ticks a checkbox.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || !ROLE_PROPS.has(node.name.name)) return;

        const value =
          node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;

        if (value?.type === "Literal" && CHECKABLE_ROLES.has(String(value.value))) {
          context.report({ node, messageId: "rawCheckable" });
        }
      },
    };
  },
});
