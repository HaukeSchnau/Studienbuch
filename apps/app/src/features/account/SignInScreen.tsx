import { useAtom } from "@effect/atom-react";
import * as Option from "effect/Option";
import { useRouter } from "expo-router";
import { Keyboard } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import {
  OtherWay,
  PasskeyLead,
  ProblemText,
  reasonOf,
  reasonOfExit,
  useCredentials,
} from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { Button, Field, Section } from "./SharedUi.tsx";

/** "Anmelden": a passkey first, email and password below. */
export function SignInScreen() {
  const router = useRouter();
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();

  const [passkey, signInWithPasskey] = useAtom(AccountState.signInWithPasskey, {
    mode: "promiseExit",
  });

  const [withPassword, signIn] = useAtom(AccountState.signIn, { mode: "promiseExit" });

  const submit = async () => {
    Keyboard.dismiss();
    const exit = await signIn({ email, password });

    // The server sent a new code with the refusal.
    if (Option.contains(reasonOfExit(exit), "email-unconfirmed")) {
      router.push({ pathname: "/e-mail-bestaetigen", params: { email: email.trim() } });
    }
  };

  return (
    <HeroScreen title="Anmelden" subtitle="Schön, dass du da bist.">
      <Section>
        <PasskeyLead>Mit deinem Passkey bist du in Sekunden drin, ganz ohne Passwort.</PasskeyLead>
        <Button
          label="Mit Passkey anmelden"
          block
          busy={passkey.waiting}
          onPress={() => void signInWithPasskey()}
        />
        <ProblemText reason={reasonOf(passkey)} />
      </Section>
      <Section title="Mit E-Mail und Passwort">
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
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <ProblemText
          reason={Option.filter(reasonOf(withPassword), (reason) => reason !== "email-unconfirmed")}
        />
        <Button
          kind="quiet"
          label="Anmelden"
          block
          busy={withPassword.waiting}
          onPress={() => void submit()}
        />
      </Section>
      <OtherWay
        question="Noch kein Konto?"
        label="Konto anlegen"
        onPress={() => router.push("/konto-anlegen")}
      />
    </HeroScreen>
  );
}
