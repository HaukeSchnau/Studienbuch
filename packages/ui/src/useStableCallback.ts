// Ported from T3 Code (pingdotgg/t3code, apps/web/src/hooks/useStableCallback.ts).
// MIT License, Copyright (c) 2026 T3 Tools Inc.
import { useInsertionEffect, useRef, useState } from "react";

/**
 * `fn` behind one identity for the component's lifetime, for a handler that a library compares by
 * identity or that an effect must not re-run for. The React Compiler memoizes everything else.
 * Call it only from handlers and effects; during render it still runs the previous commit's `fn`.
 */
export function useStableCallback<Args extends ReadonlyArray<unknown>, Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(fn);

  // Insertion effects run before every layout effect in the commit, so a child's layout effect
  // already calls this render's `fn`.
  useInsertionEffect(() => {
    latest.current = fn;
  });

  const [stable] = useState(
    () =>
      (...args: Args) =>
        latest.current(...args),
  );

  return stable;
}
