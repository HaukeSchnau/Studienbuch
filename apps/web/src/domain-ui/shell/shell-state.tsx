import { createContext, use, type ReactNode } from "react";
import type { AccountView } from "#/features/auth/access.ts";
import type { ShellContext } from "./contexts.ts";

/**
 * What every signed-in screen can rely on: the account, every context it can act in, and which one
 * is active. Provided once by the `/app` layout so that no destination refetches it and no two
 * disagree.
 *
 * Deliberately not declared in the route file that provides it. The router code-splits route
 * modules, so a destination importing this from `routes/app.tsx` would receive a second instance of
 * the module — and therefore a second, empty React context — while the provider populated the
 * first. An ordinary module has exactly one instance, which is the only reason this works.
 */
export interface Shell {
  readonly account: AccountView;
  readonly contexts: ReadonlyArray<ShellContext>;
  readonly context: ShellContext;
}

const ShellState = createContext<Shell | undefined>(undefined);

export const ShellProvider = ({
  children,
  value,
}: {
  readonly children: ReactNode;
  readonly value: Shell;
}) => <ShellState value={value}>{children}</ShellState>;

/**
 * The shell as seen from a destination.
 *
 * Throws rather than returning `undefined`, because a destination outside the shell is a routing
 * mistake rather than a state a person can reach: every one of them is a child of that layout.
 */
export const useShell = () => {
  const shell = use(ShellState);
  if (shell === undefined) {
    // oxlint-disable-next-line anti-slop/no-throwing-errors -- A destination outside the shell is a programming error, not a failure a person can cause.
    throw new Error("A destination was rendered outside the application shell");
  }
  return shell;
};
