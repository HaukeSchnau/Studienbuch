import { RegistryContext, useAtom, useAtomMount } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useRouter } from "expo-router";
import { use } from "react";

import { type Answer, useConfirm } from "../../ui/useConfirm.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { Account } from "./Account.ts";
import { ProblemText, reasonOf } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";

/**
 * "Abmelden": asks first unless nothing would be lost (`Account.signOutWarning`), with the notebook
 * checked and the unsent changes counted at the press, then forgets this device's account. When
 * only this device opens the notebook, the question offers "Notfallkarte erstellen" first. It shows
 * only while the device holds an account, live or ended.
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
  const registry = use(RegistryContext);
  const [checked, check] = useAtom(KeysState.checkSignOut(accountId), { mode: "promiseExit" });
  const [result, signOut] = useAtom(AccountState.signOut, { mode: "promiseExit" });
  const confirm = useConfirm();

  // Reading the unsent changes starts the account's engine, so they are current at the press.
  useAtomMount(AccountState.unsent);

  const press = async (): Promise<void> => {
    const notebook = AsyncResult.fromExit(await check());
    // After the check, which can take seconds: a change saved meanwhile counts too.
    const unsent = registry.get(AccountState.unsent);

    const warning = Account.signOutWarning(
      AsyncResult.map(unsent, (each) => each.count),
      notebook,
    );

    const answer = await Option.match(warning, {
      onNone: () => Promise.resolve<Answer>("proceed"),
      onSome: ({ paragraphs, offerCard }) =>
        confirm.ask({
          title: "Abmelden?",
          paragraphs,
          proceed: "Trotzdem abmelden",
          instead: offerCard ? "Notfallkarte erstellen" : undefined,
        }),
    });

    if (answer === "instead") router.push("/notizbuch-schluessel");

    if (answer !== "proceed") return;

    const exit = await signOut(
      AsyncResult.isSuccess(unsent) ? Option.some(unsent.value.newest) : Option.none(),
    );

    // A change saved after the question isn't lost unasked: the question comes again with it.
    if (
      Option.exists(
        Exit.findErrorOption(exit),
        (error) => error._tag === "AccountEngine.MoreUnsent",
      )
    ) {
      await press();
    }
  };

  return (
    <>
      <ProblemText reason={reasonOf(result)} />
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
