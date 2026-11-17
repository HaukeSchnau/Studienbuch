import { useAtom } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { Field } from "@stu/ui/Field";
import { Text } from "@stu/ui/Text";
import * as Exit from "effect/Exit";
import { Keyboard } from "react-native";

import { ProblemText, reasonOf, useCredentials } from "../account/AccountForm.tsx";
import { KeysState } from "./KeysState.ts";

/**
 * "Kurz bestätigen": a new sign-in, by passkey or password, before a step that needs a fresh one
 * (`Keys.freshSignInMinutes`). `why` says which step and why it asks.
 */
export function ConfirmSignIn({
  accountId,
  why,
  onConfirmed,
}: {
  readonly accountId: string;
  readonly why: string;
  readonly onConfirmed: () => void;
}) {
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();
  const [passkey, withPasskey] = useAtom(KeysState.withPasskey(accountId), { mode: "promiseExit" });

  const [withPasswordResult, withPassword] = useAtom(KeysState.withPassword(accountId), {
    mode: "promiseExit",
  });

  const confirmed = (exit: Exit.Exit<unknown, unknown>) => {
    if (Exit.isSuccess(exit)) onConfirmed();
  };

  return (
    <Card padded title="Kurz bestätigen">
      <Text variant="subhead">{why}</Text>
      <Button
        label="Mit Passkey bestätigen"
        block
        busy={passkey.waiting}
        onPress={() => void withPasskey().then(confirmed)}
      />
      <ProblemText reason={reasonOf(passkey)} />
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
        onSubmitEditing={() => {
          Keyboard.dismiss();
          void withPassword({ email, password }).then(confirmed);
        }}
      />
      <ProblemText reason={reasonOf(withPasswordResult)} />
      <Button
        label="Mit Passwort bestätigen"
        kind="quiet"
        block
        busy={withPasswordResult.waiting}
        onPress={() => {
          Keyboard.dismiss();
          void withPassword({ email, password }).then(confirmed);
        }}
      />
    </Card>
  );
}
