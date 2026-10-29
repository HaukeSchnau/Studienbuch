import { useAtomSet } from "@effect/atom-react";
import * as Option from "effect/Option";

import { Button } from "../../ui/Button.tsx";
import { confirm } from "../../ui/confirm.ts";
import { Account } from "./Account.ts";
import { AccountState } from "./AccountState.ts";

export interface SignOutButtonProps {
  /** Changes in the outbox that the server hasn't confirmed yet. */
  readonly pending: number;
}

/** "Abmelden": asks first when changes would be lost, then forgets this device's account. */
export function SignOutButton({ pending }: SignOutButtonProps) {
  const signOut = useAtomSet(AccountState.signOut);

  const press = async () => {
    const proceed = await Option.match(Account.unsentWarning(pending), {
      onNone: () => Promise.resolve(true),
      onSome: (warning) =>
        confirm(
          "Wirklich abmelden?",
          `${warning} Sie gehen verloren, wenn du dich jetzt abmeldest.`,
          "Abmelden",
        ),
    });

    if (proceed) signOut();
  };

  return <Button kind="quiet" label="Abmelden" onPress={() => void press()} />;
}
