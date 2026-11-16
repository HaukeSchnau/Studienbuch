import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import { resolve } from "./bindings.ts";
import { propertyKey, staticString, unwrap } from "./syntax.ts";

type ObjectExpression = Extract<ESTree.Node, { type: "ObjectExpression" }>;

const CHECKABLE_ROLES = new Set(["checkbox", "radio"]);

const ROLE_PROPS = new Set(["accessibilityRole", "role"]);

// A checked state is what makes a control a checkbox or radio, also where its role is a variable.
const CHECKED_PROPS = new Set(["aria-checked", "accessibilityChecked"]);

/** The `const` initializer `node` names, or `node` itself. */
function followConst(context: Context, node: ESTree.Node): ESTree.Node {
  const value = unwrap(node);

  if (value.type !== "Identifier") return value;

  const definition = resolve(context, value, value.name)?.defs[0];

  if (
    definition?.type !== "Variable" ||
    definition.parent?.type !== "VariableDeclaration" ||
    definition.parent.kind !== "const" ||
    definition.node.type !== "VariableDeclarator" ||
    !definition.node.init
  ) {
    return value;
  }

  return unwrap(definition.node.init);
}

/** The branches of conditionals and `&&`, `||` and `??` in `node`, each through a `const`. */
function branches(context: Context, node: ESTree.Node): ReadonlyArray<ESTree.Node> {
  const value = followConst(context, node);

  if (value.type === "ConditionalExpression") {
    return [...branches(context, value.consequent), ...branches(context, value.alternate)];
  }

  if (value.type === "LogicalExpression") {
    return [...branches(context, value.left), ...branches(context, value.right)];
  }

  return [value];
}

const objects = (context: Context, node: ESTree.Node): ReadonlyArray<ObjectExpression> =>
  branches(context, node).flatMap((each) => (each.type === "ObjectExpression" ? [each] : []));

const makesCheckable = (context: Context, name: string, value: ESTree.Node | null): boolean => {
  if (CHECKED_PROPS.has(name)) return true;

  if (value === null) return false;

  if (ROLE_PROPS.has(name)) {
    return branches(context, value).some((each) => CHECKABLE_ROLES.has(staticString(each) ?? ""));
  }

  return (
    name === "accessibilityState" &&
    objects(context, value).some((state) =>
      state.properties.some((each) => each.type === "Property" && propertyKey(each) === "checked"),
    )
  );
};

/** A checkbox or radio goes through `Checkable`, the one pressable that answers Space on the web. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require checkboxes and radios to use `Checkable` from @stu/ui/Checkable instead of their own role or checked state.",
    },
    messages: {
      rawCheckable:
        "Build a checkbox or radio on `Checkable` from @stu/ui/Checkable, or on Checkbox, PillChoice or TickBox. react-native-web presses only buttons with Space, so a pressable with a checkbox's or radio's role or checked state ignores the key that ticks it.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier") return;

        const value =
          node.value === null
            ? null
            : node.value.type === "JSXExpressionContainer"
              ? node.value.expression.type === "JSXEmptyExpression"
                ? null
                : node.value.expression
              : node.value;

        if (makesCheckable(context, node.name.name, value)) {
          context.report({ node, messageId: "rawCheckable" });
        }
      },
      JSXSpreadAttribute(node) {
        const spread = objects(context, node.argument).some((object) =>
          object.properties.some((each) => {
            if (each.type !== "Property") return false;

            const key = propertyKey(each);

            return key !== null && makesCheckable(context, key, each.value);
          }),
        );

        if (spread) context.report({ node, messageId: "rawCheckable" });
      },
    };
  },
});
