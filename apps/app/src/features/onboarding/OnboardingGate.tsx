import { useAtomMount, useAtomValue } from "@effect/atom-react";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { ReactNode } from "react";

import { KeysState } from "../keys/KeysState.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";
import { Onboarding } from "./Onboarding.ts";
import { OnboardingScreen } from "./OnboardingScreen.tsx";
import { OnboardingState } from "./OnboardingState.ts";

/**
 * The tabs, unless the student hasn't finished the first start (`Onboarding.next`): then the first
 * start in their place. Only an unlocked device can read the encrypted name, so a locked one shows
 * the tabs with AccountNotice's way to unlock, and an account without a school shows them too.
 */
export function OnboardingGate({ children }: { readonly children: ReactNode }) {
  const account = KeysState.useAccountId();

  return Option.match(account, {
    onNone: () => children,
    onSome: (accountId) => <Gate accountId={accountId}>{children}</Gate>,
  });
}

function Gate({
  accountId,
  children,
}: {
  readonly accountId: string;
  readonly children: ReactNode;
}) {
  const status = useAtomValue(KeysState.status(accountId));
  const reading = useAtomValue(OnboardingState.reading(accountId));

  // The first start's last step outlives its screen here, and goes with the account at sign-out.
  useAtomMount(OnboardingState.finish(accountId));

  const unlocked = NotebookKeys.unlocked(status);

  if (Option.isNone(unlocked)) return null;

  if (!unlocked.value) return children;

  return AsyncResult.match(reading, {
    onInitial: () => null,
    onFailure: () => children,
    onSuccess: ({ value }) =>
      Onboarding.next(value) === "done" ? (
        children
      ) : (
        <OnboardingScreen accountId={accountId} reading={value} />
      ),
  });
}
