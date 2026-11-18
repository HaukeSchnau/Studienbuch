import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppLifecycle } from "../../infra/lifecycle/AppLifecycle.ts";
import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { useConfirm } from "../../ui/useConfirm.tsx";
import { ConfirmSignIn } from "../keys/ConfirmSignIn.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { AccountState } from "./AccountState.ts";
import { Deletion } from "./Deletion.ts";

/**
 * "Konto löschen", behind "Dieses Gerät": what goes, the question before it goes, and a fresh
 * sign-in when the last one is older than `Keys.freshSignInMinutes`. Once the account is gone,
 * the gates lead to the start.
 */
export function DeleteAccountScreen() {
  const account = KeysState.useAccountId();

  return Option.match(account, {
    onNone: () => <Redirect href="/" />,
    onSome: (accountId) => <DeleteAccount accountId={accountId} />,
  });
}

/** Whether the deletion waits for a fresh sign-in, in this screen's memory only. */
export function useWaitingForSignIn() {
  return useState(false);
}

/** A refused deletion's reason. A device that can't run the account flows has none to show. */
const isProblem = Schema.is(Deletion.Problem);

const reasonOf = (error: { readonly _tag: string }): Option.Option<Deletion.Reason> =>
  isProblem(error) ? Option.some(error.reason) : Option.none();

function DeleteAccount({ accountId }: { readonly accountId: string }) {
  const { color } = Theme.useTheme();
  const confirm = useConfirm();
  const [waiting, setWaiting] = useWaitingForSignIn();
  const [deleted, deleteAccount] = useAtom(AccountState.deleteAccount, { mode: "promiseExit" });
  const lifecycle = AsyncResult.value(useAtomValue(AppLifecycle.state));
  const offline = Option.exists(lifecycle, (state) => !state.online);

  const reason = Option.orElse(Option.flatMap(AsyncResult.error(deleted), reasonOf), () =>
    offline ? Option.some<Deletion.Reason>("offline") : Option.none(),
  );

  const run = async () => {
    const exit = await deleteAccount();

    const stale =
      Exit.isFailure(exit) &&
      Option.contains(Option.flatMap(Cause.findErrorOption(exit.cause), reasonOf), "not-fresh");

    if (stale) setWaiting(true);
  };

  const press = async () => {
    const answer = await confirm.ask({
      title: "Konto endgültig löschen?",
      paragraphs: [
        "Dein Konto, dein Notizbuch und alle Wege hinein sind dann weg. Niemand kann sie zurückholen, auch Studienbuch nicht.",
      ],
      proceed: "Endgültig löschen",
    });

    if (answer === "proceed") await run();
  };

  return (
    <HeroScreen
      title="Konto löschen"
      subtitle="Das lässt sich nicht rückgängig machen."
      back="/diagnose"
    >
      <Card padded>
        <Text>
          Wir löschen dein Konto mit allem, was dazugehört: deine Hausaufgaben und dein ganzes
          Notizbuch, deine Passkeys und deine Notfallkarten. Eine Notfallkarte öffnet danach nichts
          mehr.
        </Text>
        <Text variant="subhead" style={{ color: color.inkSoft }}>
          Auf diesem Gerät ist danach alles weg. Geräte, die bei der Löschung noch angemeldet sind,
          löschen ihre Kopie, sobald sie sich wieder verbinden. Auf anderen Geräten bleiben deine
          Einträge, bis du dort die App oder die Websitedaten löschst.
        </Text>
      </Card>
      {waiting ? (
        <ConfirmSignIn
          accountId={accountId}
          why="Bevor du dein Konto löschst, meldest du dich einmal neu an. So kann niemand mit deinem entsperrten Gerät dein Konto löschen."
          onConfirmed={() => {
            setWaiting(false);
            void run();
          }}
        />
      ) : (
        <View style={styles.actions}>
          {/* The account is gone; only this device's copy waits for the next start. */}
          {Option.contains(reason, "forget-failed") ? null : (
            <Button
              label="Konto löschen"
              kind="danger"
              block
              busy={deleted.waiting}
              disabled={offline}
              onPress={() => void press()}
            />
          )}
          {Option.match(
            Option.filter(reason, (found) => found !== "not-fresh"),
            {
              onNone: () => null,
              onSome: (found) => (
                <Text variant="subhead" style={{ color: color.danger }}>
                  {Deletion.sentence[found]}
                </Text>
              ),
            },
          )}
        </View>
      )}
      {confirm.dialog}
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Tokens.space.md },
});
