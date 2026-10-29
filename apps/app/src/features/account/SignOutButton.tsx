import { useAtomSet } from "@effect/atom-react";
import * as Option from "effect/Option";

import { Button } from "@stu/ui/Button";
import { confirm } from "../../ui/confirm.ts";
import { Account } from "./Account.ts";
import { AccountState } from "./AccountState.ts";

export interface SignOutButtonProps {
  /** Changes in the outbox that the server hasn't confirmed yet. */
  readonly pending: number;
}

/**
 * "Abmelden": asks first when changes would be lost, then forgets this device's account. It shows
 * only while the device holds an account, live or ended.
 */
export function SignOutButton({ pending }: SignOutButtonProps) {
  const access = AccountState.useAccess();
  const signOut = useAtomSet(AccountState.signOut);

  const press = async () => {
    const proceed = await Option.match(Account.unsentWarning(pending), {
      onNone: () => Promise.resolve(true),
      onSome: (warning) =>
        confirm(
          "Abmelden?",
          `${warning} Wenn du dich jetzt abmeldest, sind sie weg.`,
          "Trotzdem abmelden",
        ),
    });

    if (proceed) signOut();
  };

  if (access !== "signed-in" && access !== "ended") return null;

  return <Button kind="quiet" label="Abmelden" onPress={() => void press()} />;
}
