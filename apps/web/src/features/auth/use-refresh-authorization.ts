import { useAtomRefresh } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { accountAtom } from "./access.ts";

/** Refreshes account data and reruns guards after Better Auth changes the active identity. */
export const useRefreshAuthorization = () => {
  const refreshAccount = useAtomRefresh(accountAtom);
  const router = useRouter();

  return useCallback(async () => {
    refreshAccount();
    await router.invalidate();
  }, [refreshAccount, router]);
};
