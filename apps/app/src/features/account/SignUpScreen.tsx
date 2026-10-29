import { useAtom } from "@effect/atom-react";
import { Accounts } from "@stu/api/Accounts";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import { useRouter } from "expo-router";
import { Keyboard } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { Text } from "@stu/ui/Text";
import { AppTile, OtherWay, ProblemText, reasonOf, useCredentials } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { Button, Field, Section } from "./SharedUi.tsx";

/** "Konto anlegen": email and password, then the code from the mail. */
export function SignUpScreen() {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();
  const [result, signUp] = useAtom(AccountState.signUp, { mode: "promiseExit" });
  const short = password.length < Accounts.minPasswordLength;
  const complete = email.trim() !== "" && !short;

  const submit = async () => {
    if (!complete) return;

    Keyboard.dismiss();
    const exit = await signUp({ email, password });

    if (Exit.isSuccess(exit)) {
      router.push({ pathname: "/e-mail-bestaetigen", params: { email: email.trim() } });
    }
  };

  return (
    <HeroScreen title="Konto anlegen" subtitle="In einer Minute fertig." aside={<AppTile />}>
      <Section>
        <Field
          label="E-Mail-Adresse"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={toPassword}
        />
        <Field
          ref={passwordField}
          label="Passwort"
          hint={`Mindestens ${Accounts.minPasswordLength} Zeichen`}
          count={short ? `${password.length}/${Accounts.minPasswordLength}` : undefined}
          bad={short && password.length > 0}
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          passwordRules={`minlength: ${Accounts.minPasswordLength};`}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <ProblemText reason={reasonOf(result)} />
        <Button
          label="Konto anlegen"
          block
          disabled={!complete}
          busy={result.waiting}
          onPress={() => void submit()}
        />
        <Text variant="subhead" style={{ color: color.inkSoft }}>
          Wir schicken dir einen Code, um deine E-Mail-Adresse zu bestätigen. Deine Noten und
          Hausaufgaben verschlüsselt dein Gerät, bevor sie es verlassen.
        </Text>
      </Section>
      <OtherWay question="Schon ein Konto?" label="Anmelden" onPress={() => router.back()} />
    </HeroScreen>
  );
}
