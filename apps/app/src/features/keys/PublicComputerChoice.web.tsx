import { useAtom } from "@effect/atom-react";
import { Checkbox } from "@stu/ui/Checkbox";

import { publicComputer } from "../../infra/device/publicComputer.ts";
import { AccountState } from "../account/AccountState.ts";

/**
 * "Öffentlicher Computer" (D44): the account that signs in next keeps nothing on this computer,
 * and the notebook unlocks again on every visit. An account the device holds already stays where
 * it is, so the choice shows only while the device holds none, and holds while a sign-in runs.
 */
export function PublicComputerChoice() {
  const [checked, setChecked] = useAtom(publicComputer);
  const access = AccountState.useAccess();
  const attempting = AccountState.useAttempting();

  if (access !== "signed-out") return null;

  return (
    <Checkbox
      label="Öffentlicher Computer"
      description="Nichts auf diesem Computer speichern. Du entsperrst dein Notizbuch bei jedem Besuch neu."
      checked={checked}
      onChange={setChecked}
      disabled={attempting}
    />
  );
}
