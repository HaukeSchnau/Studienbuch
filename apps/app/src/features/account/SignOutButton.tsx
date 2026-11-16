import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useRouter } from "expo-router";

import { type Answer, useConfirm } from "../../ui/useConfirm.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { Account } from "./Account.ts";
import { AccountState } from "./AccountState.ts";

/**
 * "Abmelden": asks first unless nothing would be lost (`Account.signOutWarning`), with the notebook
 * checked at the press, then forgets this device's account. When only this device opens the
 * notebook, the question offers "Notfallkarte erstellen" first. It shows only while the device
 * holds an account, live or ended.
 */
export function SignOutButton() {
  const access = AccountState.useAccess();
  const account = KeysState.useAccountId();

  if (access !== "signed-in" && access !== "ended") return null;

  return Option.match(account, {
    onNone: () => null,
    onSome: (accountId) => <SignOut accountId={accountId} />,
  });
}

function SignOut({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const unsent = useAtomValue(AccountState.unsent);
  const [checked, check] = useAtom(KeysState.checkSignOut(accountId), { mode: "promiseExit" });
  const signOut = useAtomSet(AccountState.signOut);
  const confirm = useConfirm();

  const press = async () => {
    const notebook = AsyncResult.fromExit(await check());

    const answer = await Option.match(Account.signOutWarning(unsent, notebook), {
      onNone: () => Promise.resolve<Answer>("proceed"),
      onSome: ({ paragraphs, offerCard }) =>
        confirm.ask({
          title: "Abmelden?",
          paragraphs,
          proceed: "Trotzdem abmelden",
          instead: offerCard ? "Notfallkarte erstellen" : undefined,
        }),
    });

    if (answer === "proceed") signOut();

    if (answer === "instead") router.push("/notizbuch-schluessel");
  };

  return (
    <>
      {/* Not `busy`: that disables the button, which then loses the focus the dialog returns. */}
      <Button
        kind="quiet"
        label="Abmelden"
        onPress={() => {
          if (!checked.waiting) void press();
        }}
      />
      {confirm.dialog}
    </>
  );
}
