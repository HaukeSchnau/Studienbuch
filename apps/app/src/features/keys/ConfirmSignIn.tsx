import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { Field } from "@stu/ui/Field";
import { Text } from "@stu/ui/Text";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Keyboard } from "react-native";

import type { AuthApi } from "../../infra/auth/AuthApi.ts";
import { ProblemText, reasonOf, useCredentials } from "../account/AccountForm.tsx";
import { KeysState } from "./KeysState.ts";

/**
 * "Kurz bestätigen": a new sign-in before a step that needs a fresh one
 * (`Keys.freshSignInMinutes`). `why` says which step and why it asks. It offers only the ways the
 * account has (`AuthApi.waysIn`).
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
  const ways = waysOf(useAtomValue(KeysState.waysIn(accountId)));

  return (
    <Card padded title="Kurz bestätigen">
      <Text variant="subhead">{why}</Text>
      {Option.match(ways, {
        onNone: () => null,
        onSome: ({ passkey, password }) => (
          <>
            {passkey ? <WithPasskey accountId={accountId} onConfirmed={onConfirmed} /> : null}
            {password ? (
              <WithPassword accountId={accountId} quiet={passkey} onConfirmed={onConfirmed} />
            ) : (
              <WithoutPassword passkey={passkey} />
            )}
          </>
        ),
      })}
    </Card>
  );
}

// While the server is asked, nothing shows. If it can't say, both ways show, as before it could.
const waysOf = (
  result: AsyncResult.AsyncResult<AuthApi.WaysIn, unknown>,
): Option.Option<AuthApi.WaysIn> =>
  AsyncResult.isInitial(result)
    ? Option.none()
    : Option.some(AsyncResult.getOrElse(result, () => ({ passkey: true, password: true })));

const confirmedBy = (onConfirmed: () => void) => (exit: Exit.Exit<unknown, unknown>) => {
  if (Exit.isSuccess(exit)) onConfirmed();
};

function WithPasskey({
  accountId,
  onConfirmed,
}: {
  readonly accountId: string;
  readonly onConfirmed: () => void;
}) {
  const [passkey, withPasskey] = useAtom(KeysState.withPasskey(accountId), { mode: "promiseExit" });

  return (
    <>
      <Button
        label="Mit Passkey bestätigen"
        block
        busy={passkey.waiting}
        onPress={() => void withPasskey().then(confirmedBy(onConfirmed))}
      />
      <ProblemText reason={reasonOf(passkey)} />
    </>
  );
}

function WithPassword({
  accountId,
  quiet,
  onConfirmed,
}: {
  readonly accountId: string;
  /** A passkey comes first, so this button steps back. */
  readonly quiet: boolean;
  readonly onConfirmed: () => void;
}) {
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();

  const [withPasswordResult, withPassword] = useAtom(KeysState.withPassword(accountId), {
    mode: "promiseExit",
  });

  const submit = () => {
    Keyboard.dismiss();
    void withPassword({ email, password }).then(confirmedBy(onConfirmed));
  };

  return (
    <>
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
        onSubmitEditing={submit}
      />
      <ProblemText reason={reasonOf(withPasswordResult)} />
      <Button
        label="Mit Passwort bestätigen"
        kind={quiet ? "quiet" : "filled"}
        block
        busy={withPasswordResult.waiting}
        onPress={submit}
      />
    </>
  );
}

/**
 * The account has no address, so no password. Its Notfallkarte signs it in, and confirms here once
 * the app signs in with a card; until then, one without a passkey has no way here.
 */
function WithoutPassword({ passkey }: { readonly passkey: boolean }) {
  return passkey ? null : (
    <Text variant="subhead">
      Dein Konto hat keinen Passkey und kein Passwort, darum kannst du dich hier noch nicht neu
      anmelden.
    </Text>
  );
}
