import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Field } from "@stu/ui/Field";
import { Link } from "@stu/ui/Link";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Link as RouteLink, Redirect, useRouter } from "expo-router";
import { Keyboard, StyleSheet, View } from "react-native";

import { PublicComputerChoice } from "../keys/PublicComputerChoice.tsx";
import { AccessCode } from "./AccessCode.ts";
import { Form, Lead, OtherWay, ProblemText, reasonOf, useCredentials } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { Steps } from "./Steps.ts";

/**
 * "Konto erstellen": the school the code opened, then email and password; the code from the mail
 * follows. The name comes later, in the encrypted notebook, so the server never sees it.
 */
export function SignUpScreen() {
  // Without a redeemed code there is nothing to sign up for: the code comes first.
  return Option.match(useAtomValue(Steps.reservation), {
    onNone: () => <Redirect href="/aktivieren" />,
    onSome: (reservation) => <SignUpForm reservation={reservation} />,
  });
}

function SignUpForm({ reservation }: { readonly reservation: Access.Reservation }) {
  const router = useRouter();
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();
  const [result, signUp] = useAtom(AccountState.signUp, { mode: "promiseExit" });
  const short = password.length < Accounts.minPasswordLength;
  const complete = email.trim() !== "" && !short;

  const submit = async () => {
    if (!complete) return;

    Keyboard.dismiss();
    const exit = await signUp({ email, password, reservation });

    if (Exit.isSuccess(exit)) router.push("/e-mail-bestaetigen");
  };

  return (
    <>
      <AuthHeading>Konto erstellen</AuthHeading>
      <Lead>{AccessCode.describe(reservation)}</Lead>
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
          hint={`Mindestens ${Accounts.minPasswordLength} Zeichen.`}
          counter={
            short && password.length > 0
              ? { count: password.length, limit: Accounts.minPasswordLength }
              : undefined
          }
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
        {Option.contains(reasonOf(result), "reservation-refused") ? (
          <View style={styles.center}>
            <RouteLink href="/aktivieren" dismissTo asChild>
              <Link label="Zugangscode eingeben" variant="subhead" />
            </RouteLink>
          </View>
        ) : null}
        <Button
          kind="action"
          label={result.waiting ? "Konto wird erstellt …" : "Konto erstellen"}
          block
          disabled={!complete}
          busy={result.waiting}
          onPress={() => void submit()}
        />
      </Form>
      <OtherWay question="Schon ein Konto?" label="Anmelden" href="/anmelden" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
});
