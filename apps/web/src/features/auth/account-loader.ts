import { redirect } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import type { RouterContext } from "#/infra/effect-atom/router-context.ts";
import { accountAtom } from "./access.ts";

/** Loads the current account for a route and handles only the authentication redirect. */
export const requireAccount = (context: RouterContext, signal: AbortSignal) =>
  Effect.runPromise(
    AtomRegistry.getResult(context.atomRegistry, accountAtom, { suspendOnWaiting: true }).pipe(
      Effect.catchTag("AccessApi.AuthenticationRequired", () =>
        Effect.sync(() =>
          redirect({ to: "/anmelden", search: {}, replace: true, throw: true }),
        ).pipe(Effect.andThen(Effect.never)),
      ),
    ),
    { signal },
  );
