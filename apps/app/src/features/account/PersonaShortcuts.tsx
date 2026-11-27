import { useAtom, useAtomValue } from "@effect/atom-react";
import { Demo } from "@stu/api/Demo";
import { System } from "@stu/api/System";
import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { StyleSheet, View } from "react-native";

import { ServerInfo } from "../diagnostics/ServerInfo.ts";
import { PublicComputerChoice } from "../keys/PublicComputerChoice.tsx";
import { ProblemText, reasonOf } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";

const names: Record<Demo.Persona, string> = { lena: "Lena", tom: "Tom" };

/**
 * "Anmelden als Lena" and "Anmelden als Tom": a test shortcut into the demo school's students,
 * without a password. One web build serves every server, so it shows only once this server says it
 * is a development or preview server (`System.info`), and the server checks again on sign-in.
 * `withChoice` brings "Öffentlicher Computer" to a screen that has no choice of its own.
 */
export function PersonaShortcuts({ withChoice = false }: { readonly withChoice?: boolean }) {
  const info = useAtomValue(ServerInfo.info);
  const { color } = Theme.useTheme();

  if (!AsyncResult.isSuccess(info) || !System.isDevelopmentOrPreview(info.value.environment)) {
    return null;
  }

  return (
    <View style={[styles.box, { borderColor: color.hairline }]}>
      <Text
        variant="footnote"
        style={[styles.tag, { backgroundColor: color.warningTint, color: color.warning }]}
      >
        Nur zum Testen
      </Text>
      {withChoice ? <PublicComputerChoice /> : null}
      {Demo.Persona.literals.map((persona) => (
        <PersonaButton key={persona} persona={persona} />
      ))}
      <Text variant="footnote" weight="regular" style={{ color: color.inkSoft }}>
        Ohne Passwort, mit den Daten der Demo-Schule. Das gibt es nur auf Entwicklungs- und
        Vorschauservern.
      </Text>
    </View>
  );
}

function PersonaButton({ persona }: { readonly persona: Demo.Persona }) {
  const [result, signIn] = useAtom(AccountState.signInAs(persona), { mode: "promiseExit" });
  const attempting = AccountState.useAttempting();
  const signingIn = AccountState.useSigningIn(result);

  return (
    <>
      <Button
        kind="secondary"
        small
        block
        label={signingIn ? "Anmeldung läuft …" : `Anmelden als ${names[persona]}`}
        busy={signingIn}
        disabled={attempting}
        onPress={() => void signIn()}
      />
      <ProblemText reason={reasonOf(result)} />
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: Tokens.space.xl,
    padding: Tokens.space.lg,
    gap: Tokens.space.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: "dashed",
    borderRadius: Tokens.radius.field,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: Tokens.space.sm,
    paddingVertical: Tokens.space.xxs,
    borderRadius: Tokens.radius.pill,
    overflow: "hidden",
  },
});
