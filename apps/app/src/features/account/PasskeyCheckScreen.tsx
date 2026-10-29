import { useAtom, useAtomValue } from "@effect/atom-react";
import { Tokens } from "@stu/ui/Tokens";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "../../ui/Button.tsx";
import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { Text } from "../../ui/Text.tsx";
import { ServerInfo } from "../diagnostics/ServerInfo.ts";
import { AccountState } from "./AccountState.ts";
import { Section } from "./SharedUi.tsx";

/**
 * "Passkey-Test" on every server but production. The check needs beta, the one public host real
 * phones' passkeys reach; delete the route once Hauke ran spikes/passkey-prf.md.
 */
export function PasskeyCheckScreen() {
  const allowed = AsyncResult.match(useAtomValue(ServerInfo.info), {
    onInitial: () => undefined,
    onFailure: () => false,
    onSuccess: ({ value }) => value.environment !== "production",
  });

  if (allowed === undefined) return null;

  return allowed ? <PasskeyCheck /> : <Redirect href="/anmelden" />;
}

/**
 * The device check of design/spikes/passkey-prf.md. It shows what this platform's passkey says
 * about PRF, as fingerprints, so two devices or two sign-ins can be compared.
 */
function PasskeyCheck() {
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
