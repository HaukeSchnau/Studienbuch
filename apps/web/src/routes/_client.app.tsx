import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
  useMatchRoute,
  useParams,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAccount } from "#/features/auth/account-loader.ts";
import { AppErrorState, AppNotFound } from "#/domain-ui/shell/app-error-states.tsx";
import { AppShell } from "#/domain-ui/shell/app-shell.tsx";
import { contextsFor, findContext } from "#/domain-ui/shell/contexts.ts";
import { ShellProvider } from "#/domain-ui/shell/shell-state.tsx";
import { rememberContext, rememberedContext } from "#/domain-ui/shell/remembered-context.ts";

export const Route = createFileRoute("/_client/app")({
  beforeLoad: async ({ context, abortController }) => {
    const account = await requireAccount(context, abortController.signal);
    const contexts = contextsFor(account);
    if (contexts.length === 0) {
      redirect({ to: "/aktivieren", replace: true, throw: true });
    }
    return { account, contexts };
  },
  component: AppLayout,
  // The public site's error pages send people to the landing page, which is the wrong destination
  // for someone already signed in. Everything below `/app` gets its own, inside the shell.
  errorComponent: ({ reset }) => <AppErrorState reset={reset} />,
  notFoundComponent: () => <AppNotFound />,
});

/**
 * The signed-in layout.
 *
 * It resolves who is here and which of their lives they are living, then hands both to the chrome
 * and gets out of the way. Two things it deliberately does not do: fetch anything a destination
 * could fetch itself, and re-mount when the destination changes — the shell staying put across
 * navigation is what makes the rail and the bar feel like the application rather than part of a page.
 */
function AppLayout() {
  const { account, contexts } = Route.useRouteContext();

  /**
   * The active context, in order of authority: what the address bar says, then what this person
   * last chose, then their first. The URL wins because a link someone was sent has to open where it
   * points, whatever they were doing before.
   *
   * The router is asked what it matched rather than the pathname being taken apart here. Slicing
   * segments meant a second parser for a grammar the route tree already defines, and it had to be
   * told how many of them a context is worth — which is how `/app/operator/schulen` came to be read
   * as a school called "operator" and bounced in a loop.
   */
  const { school, rolle } = useParams({ strict: false });
  const inOperator = useMatchRoute()({ to: "/app/operator", fuzzy: true }) !== false;
  const requested = inOperator
    ? findContext(contexts, ["operator"])
    : school === undefined || rolle === undefined
      ? undefined
      : findContext(contexts, [school, rolle]);

  /*
   * A URL naming a context this account does not hold still resolves to *some* context, so that the
   * chrome around the refusal is usable: the destination below renders the explanation, and the rail
   * beside it offers somewhere to go. Redirecting instead — which is what happened before — left no
   * room to say anything at all.
   */
  const context = requested ?? findContext(contexts, rememberedContext()) ?? contexts.at(0);

  useEffect(() => {
    if (context !== undefined) rememberContext(context.ref);
  }, [context]);

  if (context === undefined) {
    return <Navigate to="/aktivieren" replace />;
  }

  return (
    <ShellProvider value={{ account, contexts, context }}>
      <AppShell>
        <Outlet />
      </AppShell>
    </ShellProvider>
  );
}
