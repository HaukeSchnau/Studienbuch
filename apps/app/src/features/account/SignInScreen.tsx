import { useAtom, useAtomSet } from "@effect/atom-react";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Field } from "@stu/ui/Field";
import { Link } from "@stu/ui/Link";
import * as Option from "effect/Option";
import { useRouter } from "expo-router";
import { Keyboard, StyleSheet, View } from "react-native";

import { PublicComputerChoice } from "../keys/PublicComputerChoice.tsx";
import { Form, Or, OtherWay, ProblemText, reasonOf, useCredentials } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { Steps } from "./Steps.ts";

/**
 * "Anmelden", in the old web's order: email and password, "Passwort vergessen?", then "oder" and
 * the passkey. A device whose session ended goes back to its tabs from here, and a code can't add
 * another account to it.
 */
export function SignInScreen() {
  const router = useRouter();
  const access = AccountState.useAccess();
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();
  const keepTyped = useAtomSet(Steps.forgotten);
  const keepSentTo = useAtomSet(Steps.resetSentTo);

  const [passkey, signInWithPasskey] = useAtom(AccountState.signInWithPasskey, {
    mode: "promiseExit",
  });

  const [withPassword, signIn] = useAtom(AccountState.signIn, { mode: "promiseExit" });

  // "Passwort vergessen?" starts with the address typed here, from its first step.
  const forgot = () => {
    keepTyped(Option.some(email.trim()));
    keepSentTo(Option.none());
    router.push("/passwort-vergessen");
  };

  // An empty field would only go to the server and back.
  const complete = email.trim() !== "" && password !== "";

  const submit = async () => {
    if (!complete) return;

    Keyboard.dismiss();
    await signIn({ email, password });
  };

  return (
    <>
      <AuthHeading>Anmelden</AuthHeading>
      <Form>
        <PublicComputerChoice />
        <Field
          pill
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
          pill
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
        <ProblemText reason={reasonOf(withPassword)} />
        <Button
          kind="action"
          label={withPassword.waiting ? "Anmeldung läuft …" : "Anmelden"}
          block
          disabled={!complete}
          busy={withPassword.waiting}
          onPress={() => void submit()}
        />
      </Form>
      <View style={styles.forgot}>
        <Link label="Passwort vergessen?" variant="subhead" onPress={forgot} />
      </View>
      <Or />
      <Button
        kind="secondary"
        label="Mit Passkey anmelden"
        block
        busy={passkey.waiting}
        onPress={() => void signInWithPasskey()}
      />
      {Option.match(reasonOf(passkey), {
        onNone: () => null,
        onSome: (reason) => (
          <View style={styles.passkeyProblem}>
            <ProblemText reason={Option.some(reason)} />
          </View>
        ),
      })}
      {access === "ended" ? (
        <OtherWay label="Zurück zur Übersicht" href="/" back />
      ) : (
        <OtherWay
          question="Zugangscode von deiner Schule?"
          label="Zugang aktivieren"
          href="/aktivieren"
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // mt-4, centred
  forgot: { alignItems: "center", marginTop: 4 },
  passkeyProblem: { marginTop: 12 },
});
