import { useAtom } from "@effect/atom-react";
import { Tokens } from "@stu/ui/Tokens";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { StyleSheet, View } from "react-native";

import { Button } from "@stu/ui/Button";
import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { Text } from "@stu/ui/Text";
import { Section } from "./SharedUi.tsx";
import { AccountState } from "./AccountState.ts";

/**
 * "Passkey-Test": the device check of design/spikes/passkey-prf.md. It shows what this platform's
 * passkey says about PRF, as fingerprints, so two devices or two sign-ins can be compared.
 */
export function PasskeyCheckScreen() {
  const [created, create] = useAtom(AccountState.checkCreate);
  const [asserted, assert] = useAtom(AccountState.checkAssert);

  return (
    <HeroScreen title="Passkey-Test" subtitle="Für die Geräteprüfung.">
      <Section title="1. Test-Passkey anlegen">
        <Text>Legt einen Passkey „Passkey-Test“ an und zeigt, was er zu PRF sagt.</Text>
        <View style={styles.actions}>
          <Button label="Test-Passkey anlegen" busy={created.waiting} onPress={() => create()} />
        </View>
        <Text variant="headline" selectable>
          {AsyncResult.match(created, {
            onInitial: () => "Noch nicht geprüft.",
            onFailure: ({ cause }) => `Fehler: ${String(cause).slice(0, 200)}`,
            onSuccess: ({ value }) => `PRF beim Anlegen: ${value}`,
          })}
        </Text>
      </Section>
      <Section title="2. Mit Passkey prüfen">
        <Text>Meldet sich mit einem Passkey dieses Servers an. Zweimal prüfen: gleicher Wert?</Text>
        <View style={styles.actions}>
          <Button label="Mit Passkey prüfen" busy={asserted.waiting} onPress={() => assert()} />
        </View>
        <Text variant="headline" selectable>
          {AsyncResult.match(asserted, {
            onInitial: () => "Noch nicht geprüft.",
            onFailure: ({ cause }) => `Fehler: ${String(cause).slice(0, 200)}`,
            onSuccess: ({ value }) => `Passkey ${value.credential}, PRF ${value.prf}`,
          })}
        </Text>
      </Section>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: "flex-start", gap: Tokens.space.md },
});
