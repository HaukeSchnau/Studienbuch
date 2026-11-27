import { Button } from "@stu/ui/Button";
import { useRouter } from "expo-router";

import { AccountState } from "./AccountState.ts";

/**
 * "Konto löschen" on Profil, while the device holds a live session: the server deletes
 * the account only for a signed-in device. One whose session ended signs in again first.
 */
export function DeleteAccountButton() {
  const router = useRouter();
  const access = AccountState.useAccess();

  if (access !== "signed-in") return null;

  return (
    <Button kind="quiet" label="Konto löschen" onPress={() => router.push("/konto-loeschen")} />
  );
}
