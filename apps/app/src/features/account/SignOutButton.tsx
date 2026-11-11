import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Option from "effect/Option";

import { Button } from "@stu/ui/Button";
import { confirm } from "../../ui/confirm.ts";
import { Account } from "./Account.ts";
import { AccountState } from "./AccountState.ts";

/**
 * "Abmelden": asks first unless the engine counted no unsent change, then forgets this device's
 * account. It shows only while the device holds an account, live or ended.
 */
export function SignOutButton() {
  const access = AccountState.useAccess();
  const unsent = useAtomValue(AccountState.unsent);
  const signOut = useAtomSet(AccountState.signOut);

  const press = async () => {
    const proceed = await Option.match(Account.unsentWarning(unsent), {
      onNone: () => Promise.resolve(true),
      onSome: (warning) => confirm("Abmelden?", warning, "Trotzdem abmelden"),
    });

    if (proceed) signOut();
  };

  if (access !== "signed-in" && access !== "ended") return null;

  return <Button kind="quiet" label="Abmelden" onPress={() => void press()} />;
}
