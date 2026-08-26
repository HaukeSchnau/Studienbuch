import { redirect } from "@tanstack/react-router";
import type { ShellContext } from "./contexts.ts";
import { contextParams, landingDestination } from "./destinations.ts";

/** Redirects before render to the first destination available in a context. */
export const redirectToContext = (context: ShellContext): void => {
  const destination = landingDestination(context.ref);
  if (destination === undefined) {
    redirect({ to: "/app/konto", replace: true, throw: true });
    return;
  }
  if (destination.placement !== "school") {
    redirect({ to: destination.to, replace: true, throw: true });
    return;
  }

  const params = contextParams(context.ref);
  if (params === undefined) {
    redirect({ to: "/app/konto", replace: true, throw: true });
    return;
  }
  redirect({ to: destination.to, params, replace: true, throw: true });
};
