import { defineRule, type ESTree, type Scope, type Variable } from "@oxlint/plugins";

import {
  enclosingFunction,
  type FunctionNode,
  memberKey,
  moduleExportName,
  unwrap,
} from "./syntax.ts";

// A component holds almost nothing itself. Each kind of state has a home with a contract:
//
// - Domain data: SQLite, read through Effect Atom live queries.
// - Navigation and selection: the router.
// - Drafts: atoms persisted on the device (`Atom.kvs`).
// - Device and server state: atoms over Effect services. Atoms own every subscription.
// - Writes: the sync engine shows a write at once and settles it later. An RPC outside sync and
//   its result live in an atom from `AtomRpc`'s `mutation`.
// - Animation: Reanimated shared values. `useAnimatedReaction` stays allowed, because it runs
//   worklets on the UI thread between shared values, and reaching React from there takes an
//   explicit hop to JS.
// - State of one component: `useReducer` with a reducer declared at module level or imported, or
//   an atom. `Atom.make` at module level suits a component that renders once, and the registry
//   drops its value when the last reader unmounts. `Atom.family` keyed by an id gives one per row,
//   and `ScopedAtom.make` from @effect/atom-react one per subtree.
// - Memoization: the React Compiler. A handler that must keep one identity uses
//   `useStableCallback` from @stu/ui. A value created exactly once per component uses `useRef`
//   with lazy init, or an atom, because neither `useMemo` nor the compiler guarantees that a value
//   is never recreated.
//
// What fits none of these goes into a custom hook: an exported `use…` function whose doc comment
// states its purpose and contract. Only custom hooks call the building blocks below. `memo` has no
// such exception, because the compiler memoizes components. Where it bails out on one, a
// suppression gives the reason.

type Kind = "state" | "effect" | "subscription" | "memoization" | "memo" | "reducer";

// By the module that exports them. Purpose-built hooks such as `useColorScheme` or `useFonts` have
// a contract and stay allowed; these are the generic building blocks.
const HOOKS: ReadonlyMap<string, ReadonlyMap<string, Kind>> = new Map([
  [
    "react",
    new Map<string, Kind>([
      ["useState", "state"],
      ["useOptimistic", "state"],
      ["useActionState", "state"],
      ["useEffect", "effect"],
      ["useLayoutEffect", "effect"],
      ["useInsertionEffect", "effect"],
      ["useEffectEvent", "effect"],
      ["useSyncExternalStore", "subscription"],
      ["useMemo", "memoization"],
      ["useCallback", "memoization"],
      ["memo", "memo"],
      ["useReducer", "reducer"],
    ]),
  ],
  ["react-dom", new Map<string, Kind>([["useFormState", "state"]])],
  [
    "expo",
    new Map<string, Kind>([
      ["useEvent", "subscription"],
      ["useEventListener", "effect"],
    ]),
  ],
  ["expo-router", new Map<string, Kind>([["useFocusEffect", "effect"]])],
  ["@react-navigation/native", new Map<string, Kind>([["useFocusEffect", "effect"]])],
  ["@react-navigation/core", new Map<string, Kind>([["useFocusEffect", "effect"]])],
  ["@tanstack/react-router", new Map<string, Kind>([["useLayoutEffect", "effect"]])],
  ["@effect/atom-react", new Map<string, Kind>([["useAtomSubscribe", "effect"]])],
]);

const HOOK_NAME = /^use[A-Z]/u;

const IN_A_CUSTOM_HOOK =
  " Only an exported `use…` hook whose doc comment states its purpose and contract may call it.";

/** The `export` that declares `fn`, when `fn` is a function named like a hook and exported in place. */
function hookExport(fn: FunctionNode): ESTree.Node | null {
  const { parent } = fn;

  if (fn.type === "FunctionDeclaration") {
    const exported =
      parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration";

    return exported && fn.id !== null && HOOK_NAME.test(fn.id.name) ? parent : null;
  }

  // `export const useThing = () => …`
  if (
    parent.type !== "VariableDeclarator" ||
    parent.init !== fn ||
    parent.id.type !== "Identifier" ||
    !HOOK_NAME.test(parent.id.name)
  ) {
    return null;
  }

  const declaration = parent.parent;

  return declaration.parent?.type === "ExportNamedDeclaration" ? declaration.parent : null;
}

/** React's building blocks for state, effects and memoization stay inside documented custom hooks. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Allow React's state, effect, subscription and memoization hooks only in exported, documented custom hooks, ban `memo`, and require module-level reducers.",
    },
    messages: {
      state:
        "`{{name}}` holds state without a contract. Read it from an atom or the router, or keep its transitions in `useReducer` with a module-level reducer." +
        IN_A_CUSTOM_HOOK,
      effect:
        "`{{name}}` runs an effect in a component. Atoms over Effect services own effects and subscriptions, and event handlers do the rest." +
        IN_A_CUSTOM_HOOK,
      subscription:
        "`{{name}}` subscribes in a component, but atoms own subscriptions." + IN_A_CUSTOM_HOOK,
      memoization:
        "`{{name}}` memoizes by hand, which is the React Compiler's job. A handler that must keep one identity uses `useStableCallback` from @stu/ui, and a value made exactly once uses `useRef` with lazy init or an atom." +
        IN_A_CUSTOM_HOOK,
      memo: "The React Compiler memoizes components, so `memo` is never needed. Where the compiler bails out on this component, suppress this with the reason.",
      reducer:
        "Declare this reducer at module level or import it, so its transitions stay pure and explicit.",
    },
  },
  create(context) {
    const { sourceCode } = context;

    const isDocumented = (node: ESTree.Node) =>
      sourceCode
        .getCommentsBefore(node)
        .some(
          (comment) =>
            comment.type === "Block" &&
            comment.value.startsWith("*") &&
            comment.value.replaceAll(/[\s*]/gu, "") !== "",
        );

    const isInCustomHook = (node: ESTree.Node) => {
      const fn = enclosingFunction(node);
      const declaration = fn === null ? null : hookExport(fn);

      return declaration !== null && isDocumented(declaration);
    };

    /** The variable `name` refers to at `node`, null for an undeclared global. */
    const resolve = (node: ESTree.Node, name: string): Variable | null => {
      for (
        let scope: Scope | null = sourceCode.getScope(node);
        scope !== null;
        scope = scope.upper
      ) {
        const variable = scope.set.get(name);

        if (variable !== undefined) return variable;
      }

      return null;
    };

    /** Whether `node` names something imported or declared at module level, such as `Draft.reduce`. */
    const isModuleLevel = (node: ESTree.Node) => {
      let root = unwrap(node);

      while (root.type === "MemberExpression") root = unwrap(root.object);

      if (root.type !== "Identifier") return false;

      const scope = resolve(root, root.name)?.scope.type;

      return scope === undefined || scope === "module" || scope === "global";
    };

    /** `hook` is `useReducer` or `React.useReducer`. */
    const checkReducer = (hook: ESTree.Node) => {
      const call = hook.parent;

      if (call?.type !== "CallExpression" || call.callee !== hook) return;

      const [reducer] = call.arguments;

      if (reducer !== undefined && !isModuleLevel(reducer)) {
        context.report({ node: reducer, messageId: "reducer" });
      }
    };

    const check = (node: ESTree.Node, name: string, kind: Kind) => {
      if (kind === "reducer") checkReducer(node);
      else if (kind === "memo") context.report({ node, messageId: "memo" });
      else if (!isInCustomHook(node)) context.report({ node, messageId: kind, data: { name } });
    };

    return {
      ImportDeclaration(node) {
        const hooks = HOOKS.get(node.source.value);

        if (hooks === undefined) return;

        for (const specifier of node.specifiers) {
          const references = sourceCode
            .getDeclaredVariables(specifier)
            .flatMap((variable) => variable.references);

          if (specifier.type === "ImportSpecifier") {
            const name = moduleExportName(specifier.imported);
            const kind = hooks.get(name);

            if (kind === undefined) continue;

            for (const { identifier } of references) check(identifier, name, kind);

            continue;
          }

          // A default or namespace import reaches the hooks as members, as in `React.useState`.
          for (const { identifier } of references) {
            const member = identifier.parent;

            if (member?.type !== "MemberExpression" || member.object !== identifier) continue;

            const name = memberKey(member);
            const kind = name === null ? undefined : hooks.get(name);

            if (name !== null && kind !== undefined) check(member, name, kind);
          }
        }
      },
    };
  },
});
