import { useAtom, useAtomValue } from "@effect/atom-react";
import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Redirect, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { ProblemText, reasonOf } from "../account/AccountForm.tsx";
import { KeyProblem, keyReasonOf, MethodRow } from "./KeysUi.tsx";
import { KeysState } from "./KeysState.ts";

/** "Notizbuch entsperren": the ways a signed-in device without the notebook's key gets it. */
export function UnlockScreen() {
  const account = KeysState.useAccountId();

  return Option.match(account, {
    onNone: () => <Redirect href="/anmelden" />,
    onSome: (accountId) => <Unlock accountId={accountId} />,
  });
}

function Unlock({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const status = useAtomValue(KeysState.status(accountId));
  const prfProblem = useAtomValue(KeysState.prfProblem);
  const [passkey, withPasskey] = useAtom(KeysState.withPasskey(accountId));
  const current = Option.getOrUndefined(AsyncResult.value(status))?._tag;

  // A device whose key the account renewed elsewhere holds one, and unlocks again here.
  const behind = Option.contains(KeysState.useHeld(accountId), "keys-behind");

  if (current === "Unlocked" && !behind) return <Redirect href="/" />;

  return (
    <HeroScreen
      title="Notizbuch entsperren"
      subtitle="Du bist angemeldet. Deine Hausaufgaben sind verschlüsselt."
    >
      <Card padded>
        <View style={styles.rows}>
          <MethodRow
            glyph="passkey"
            title="Mit Passkey"
            detail="Face ID, Fingerabdruck oder Displaysperre"
            busy={passkey.waiting}
            onPress={() => withPasskey()}
          />
          <View style={[styles.rule, { backgroundColor: color.hairline }]} />
          <MethodRow
            glyph="code"
            title="Mit der Notfallkarte"
            detail="Den Code von deiner Karte eintippen"
            onPress={() => router.push("/notfallkarte")}
          />
        </View>
        <ProblemText reason={reasonOf(passkey)} />
        <KeyProblem reason={Option.orElse(keyReasonOf(passkey), () => prfProblem)} />
        {current === "Offline" ? (
          <Text variant="subhead" style={{ color: color.inkSoft }}>
            Zum Entsperren brauchst du einmal Internet.
          </Text>
        ) : null}
        {current === "NotHere" ? (
          <Text variant="subhead" style={{ color: color.inkSoft }}>
            Dein Notizbuch richtest du auf deinem eigenen Gerät ein, nicht auf einem öffentlichen
            Computer. Danach kannst du es hier mit Passkey oder Notfallkarte öffnen.
          </Text>
        ) : null}
      </Card>
      <Text variant="subhead" style={[styles.note, { color: color.inkSoft }]}>
        Studienbuch selbst hat keinen Schlüssel zu deinem Notizbuch. Nur deine Geräte, dein Passkey
        und deine Notfallkarte können es öffnen.
      </Text>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 0 },
  rule: { height: StyleSheet.hairlineWidth },
  note: { paddingHorizontal: Tokens.space.lg },
});
