import { useAtom } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { useRunning } from "../account/AccountForm.tsx";
import { CardCodeField, KeyProblem, keyReasonOf } from "./KeysUi.tsx";
import { KeysState } from "./KeysState.ts";

/** "Notfallkarte": the code typed in, which opens the notebook on this device. */
export function RecoveryCodeScreen() {
  const account = KeysState.useAccountId();

  return Option.match(account, {
    onNone: () => <Redirect href="/anmelden" />,
    onSome: (accountId) => <EnterCode accountId={accountId} />,
  });
}

/** The code as typed so far. It lives in this screen's memory only. */
export function useTypedCode() {
  return useState("");
}

function EnterCode({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const [code, setCode] = useTypedCode();
  const [opened, open] = useAtom(KeysState.unlockWithCode(accountId), { mode: "promiseExit" });
  const opening = useRunning(KeysState.unlockWithCode(accountId));
  const reason = keyReasonOf(opened);

  const submit = async () => {
    if (opening()) return;

    Keyboard.dismiss();

    if (Exit.isSuccess(await open(code))) router.replace("/");
  };

  return (
    <HeroScreen
      title="Notfallkarte"
      subtitle="Tipp den Code von deiner Karte ein."
      back="/notizbuch-entsperren"
    >
      <Card padded>
        <CardCodeField
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => void submit()}
          invalid={Option.isSome(reason)}
        />
        <KeyProblem reason={reason} />
        <Text variant="subhead" style={{ color: color.inkSoft }}>
          Groß- und Kleinschreibung, Leerzeichen und Bindestriche sind egal.
        </Text>
        <Button
          label="Öffnen"
          block
          busy={opened.waiting}
          disabled={code.trim() === ""}
          onPress={() => void submit()}
        />
      </Card>
    </HeroScreen>
  );
}
