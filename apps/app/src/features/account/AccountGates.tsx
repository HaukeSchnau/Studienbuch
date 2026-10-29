import { Redirect } from "expo-router";
import type { ReactNode } from "react";

import { AccountState } from "./AccountState.ts";

/**
 * The tabs, unless the device could hold an account and holds none. One whose session ended keeps
 * its data and tabs. A build without a server, or a locked keychain, shows the diagnostics.
 */
export function SignedIn({ children }: { readonly children: ReactNode }) {
  const access = AccountState.useAccess();

  if (access === "loading") return null;

  return access === "signed-out" ? <Redirect href="/anmelden" /> : children;
}

/**
 * The sign-in screens, while the device holds no account or one whose session ended, which signs
 * in again here and keeps its data.
 */
export function SignedOut({ children }: { readonly children: ReactNode }) {
  const access = AccountState.useAccess();

  if (access === "loading") return null;

  return access === "signed-out" || access === "ended" ? children : <Redirect href="/" />;
}
