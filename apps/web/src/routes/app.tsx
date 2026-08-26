import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useMemo } from "react";
import { accountAtom } from "#/features/auth/access.ts";
import { AppErrorState, AppNotFound } from "#/domain-ui/shell/app-error-states.tsx";
import { AppShell } from "#/domain-ui/shell/app-shell.tsx";
import { contextsFor, findContext } from "#/domain-ui/shell/contexts.ts";
import { ShellProvider } from "#/domain-ui/shell/shell-state.tsx";
import { rememberContext, rememberedContext } from "#/domain-ui/shell/remembered-context.ts";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";

export const Route = createFileRoute("/app")({
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const accountResult = useAtomValue(accountAtom);
  const account = AsyncResult.isSuccess(accountResult) ? accountResult.value : undefined;

  useEffect(() => {
    if (AsyncResult.isFailure(accountResult)) {
      void navigate({ to: "/anmelden", search: {}, replace: true });
    }
  }, [accountResult, navigate]);

  const contexts = useMemo(() => (account === undefined ? [] : contextsFor(account)), [account]);

  // An account with no contexts at all has nothing to show and one thing to do.
  useEffect(() => {
    if (account !== undefined && contexts.length === 0) {
      void navigate({ to: "/aktivieren", replace: true });
    }
  }, [account, contexts.length, navigate]);

  /**
   * The active context, in order of authority: what the address bar says, then what this person
   * last chose, then their first. The URL wins because a link someone was sent has to open where it
   * points, whatever they were doing before.
   */
  const context = useMemo(() => {
    if (contexts.length === 0) return undefined;
    const segments = pathname
      .replace(/^\/app\/?/, "")
      .split("/")
      .filter(Boolean);
    return (
      findContext(contexts, segments) ?? findContext(contexts, rememberedContext()) ?? contexts[0]
    );
  }, [contexts, pathname]);

  useEffect(() => {
    if (context !== undefined) rememberContext(context.ref);
  }, [context]);

  if (account === undefined || context === undefined) {
    return <ShellPlaceholder />;
  }

  return (
    <ShellProvider value={{ account, contexts, context }}>
      <AppShell context={context} contexts={contexts}>
        <Outlet />
      </AppShell>
    </ShellProvider>
  );
}

/**
 * What stands in while the account is still arriving.
 *
 * The wordmark rather than a spinner, and no navigation at all: which destinations exist is exactly
 * what is not yet known, and guessing at them would mean rearranging the bar a moment later.
 */
const ShellPlaceholder = () => (
  <div className="grid min-h-screen place-items-center bg-primary-des px-6">
    <div className="text-center">
      <Wordmark />
      <p className="working mt-4 text-sm text-ink-soft">Einen Moment ...</p>
    </div>
  </div>
);
