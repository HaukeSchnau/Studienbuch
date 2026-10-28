import { defineRule, type ESTree } from "@oxlint/plugins";

import { isModuleLevel } from "./bindings.ts";
import { isInDocumentedHook } from "./custom-hooks.ts";
import { memberKey, moduleExportName } from "./syntax.ts";

// A component holds almost nothing itself. Each kind of state has a home with a contract, which
// the messages below name. What fits none goes into an exported `use…` hook whose doc comment
// states its purpose and contract, and only such hooks call the building blocks below.

type Kind = "state" | "effect" | "subscription" | "memoization" | "memo" | "reducer";

// By the module that exports them. Purpose-built hooks such as `useColorScheme` or `useFonts` have
// a contract and stay allowed. So does Reanimated's `useAnimatedReaction`, which runs worklets
// between shared values on the UI thread.
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

const IN_A_CUSTOM_HOOK =
  " Only an exported `use…` hook whose doc comment states its purpose and contract may call it.";

// Ported from T3 Code's `no-manual-memo` (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). "use no memo" and "use no forget" skip a component the compiler would bail on, which hides
// the bailout as much as "use memo" forces a cache scope the compiler withheld.
const MEMO_DIRECTIVES = new Set(["use memo", "use no memo", "use no forget"]);

/** React's building blocks for state, effects and memoization stay inside documented custom hooks. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Allow React's state, effect, subscription and memoization hooks only in exported, documented custom hooks, ban `memo` and memo directives, and require module-level reducers.",
    },
    messages: {
      state:
        "`{{name}}` holds state without a contract. Domain data comes from atoms over SQLite live queries, navigation and selection from the router, and drafts persist in `Atom.kvs`. One component's state lives in an atom (`Atom.make` at module level, `Atom.family` per row, `ScopedAtom.make` per subtree) or in `useReducer` with a module-level reducer." +
        IN_A_CUSTOM_HOOK,
      effect:
        "`{{name}}` runs an effect in a component. Atoms over Effect services own effects and subscriptions, an RPC outside sync lives in an `AtomRpc` mutation, and event handlers do the rest." +
        IN_A_CUSTOM_HOOK,
      subscription:
        "`{{name}}` subscribes in a component, but atoms own subscriptions." + IN_A_CUSTOM_HOOK,
      memoization:
        "`{{name}}` memoizes by hand, which is the React Compiler's job. A handler that must keep one identity uses `useStableCallback` from @stu/ui. A value made exactly once uses `useRef` with lazy init or an atom, because neither `useMemo` nor the compiler promises never to recreate it." +
        IN_A_CUSTOM_HOOK,
      memo: "The React Compiler memoizes components, so `memo` is never needed. Where the compiler bails out on this component, suppress this with the reason.",
      reducer:
        "Declare this reducer at module level or import it, so its transitions stay pure and explicit.",
      useMemo:
        'Drop "use memo": restructure so the compiler caches this on its own, for example by moving plain uses of a value before the hook call that splits its scope, or by inlining the helper.',
      skipMemo:
        'Drop "{{directive}}": fix the code the compiler cannot prove safe instead of skipping it.',
    },
  },
  create(context) {
    const { sourceCode } = context;

    /** `hook` is `useReducer` or `React.useReducer`. */
    const checkReducer = (hook: ESTree.Node) => {
      const call = hook.parent;

      if (call?.type !== "CallExpression" || call.callee !== hook) return;

      const [reducer] = call.arguments;

      if (reducer !== undefined && !isModuleLevel(context, reducer)) {
        context.report({ node: reducer, messageId: "reducer" });
      }
    };

    const check = (node: ESTree.Node, name: string, kind: Kind) => {
      if (kind === "reducer") checkReducer(node);
      else if (kind === "memo") context.report({ node, messageId: "memo" });
      else if (!isInDocumentedHook(context, node))
        context.report({ node, messageId: kind, data: { name } });
    };

    return {
      ExpressionStatement(node) {
        const directive = node.directive ?? "";

        if (!MEMO_DIRECTIVES.has(directive)) return;

        if (directive === "use memo") context.report({ node, messageId: "useMemo" });
        else context.report({ node, messageId: "skipMemo", data: { directive } });
      },
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
