import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { forgetContext } from "#/domain-ui/shell/remembered-context.ts";
import { authClient } from "#/infra/auth/client.ts";
import { useRefreshAuthorization } from "./use-refresh-authorization.ts";

/**
 * Ends the session and puts the person back at the sign-in screen.
 *
 * Shared rather than written wherever a sign-out button happens to be, because the order matters and
 * is easy to get subtly wrong: the account has to be refetched and the router's guards re-run before
 * navigating, or the sign-in screen renders against a context that still believes someone is here.
 *
 * The remembered context goes too. It is a preference belonging to whoever just left, and leaving it
 * behind means the next person to sign in on this browser opens on a school that is not theirs — the
 * shell recovers, but only by silently falling back, which looks like the switcher losing its place.
 */
export const useSignOut = () => {
  const navigate = useNavigate();
  const refreshAuthorization = useRefreshAuthorization();

  return useCallback(async () => {
    await authClient.signOut();
    forgetContext();
    await refreshAuthorization();
    await navigate({ to: "/anmelden", search: {}, replace: true });
  }, [navigate, refreshAuthorization]);
};
