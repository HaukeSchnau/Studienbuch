import { Redirect } from "expo-router";
import type { ReactNode } from "react";

import { AccountState } from "./AccountState.ts";

/**
 * The tabs, once the device holds an account. One whose session ended keeps its data and tabs,
 * and only sync waits for the next sign-in.
 */
export function SignedIn({ children }: { readonly children: ReactNode }) {
  return AccountState.useSignedIn() ? children : <Redirect href="/anmelden" />;
}

/** The sign-in screens, while the device holds no account. */
export function SignedOut({ children }: { readonly children: ReactNode }) {
  return AccountState.useSignedIn() ? <Redirect href="/" /> : children;
}
