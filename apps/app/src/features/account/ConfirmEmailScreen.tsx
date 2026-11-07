import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Accounts } from "@stu/api/Accounts";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Field } from "@stu/ui/Field";
import { Link } from "@stu/ui/Link";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

import { Account } from "./Account.ts";
import {
  Done,
  Form,
  OtherWay,
  PasskeyLead,
  ProblemText,
  reasonOf,
  Strong,
  useCredentials,
} from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { CodeField, codeLength } from "./CodeField.tsx";
import { Steps } from "./Steps.ts";

/**
 * "Schau in dein Postfach": the six digits from the mail for the sign-up waiting for its code, also
 * after a reload or a restart. A confirmed address goes on to "Geschafft!"; back from there finds
 * this step empty while that session is kept or ends.
 */
export function ConfirmEmailScreen() {
  const confirmed = AccountState.useConfirmed();

  return AsyncResult.match(useAtomValue(AccountState.signingUp), {
    onInitial: () => null,
    onFailure: () => <Redirect href="/aktivieren" />,
    onSuccess: ({ value }) =>
      Option.match(value, {
        onSome: (waiting) => <CodeEntry key={waiting.email} waiting={waiting} />,
        onNone: () => (Option.isSome(confirmed) ? null : <Redirect href="/aktivieren" />),
      }),
  });
}

function CodeEntry({ waiting }: { readonly waiting: Account.SigningUp }) {
  const router = useRouter();
  const { email } = waiting;
  const [result, confirm] = useAtom(AccountState.confirmEmail, { mode: "promiseExit" });
  const forget = useAtomSet(AccountState.confirmEmail);
  const code = useCode(() => forget(Atom.Reset));
  const { password, setPassword } = useCredentials();
  const [resent, sendCode] = useAtom(AccountState.sendCode);
  const cancel = useAtomSet(AccountState.cancelSignUp);
  const keepReservation = useAtomSet(Steps.reservation);

  // After a reload or a restart the device no longer holds the password it signed up with.
  const asksPassword = Option.isNone(waiting.password);
  const complete = code.value.length === codeLength && (!asksPassword || password.length > 0);

  const submit = async () => {
    if (!complete) return;

    Keyboard.dismiss();

    const exit = await confirm({
      email,
      code: code.value,
      password: asksPassword ? password : undefined,
    });

    if (Exit.isSuccess(exit)) {
      keepReservation(Option.none());
      router.push("/geschafft");
    }
  };

  // Another address takes the same code's reservation back to "Konto erstellen".
  const otherAddress = () => {
    keepReservation(Option.some(waiting.reservation));
    router.dismissTo("/konto-erstellen");
    cancel();
  };

  return (
    <>
      <Done title="Schau in dein Postfach">
        Wir haben einen Code an <Strong>{email}</Strong> geschickt. Er gilt {Accounts.codeMinutes}{" "}
        Minuten.
      </Done>
      <Form>
        <CodeField value={code.value} onChangeText={code.set} />
        {asksPassword ? (
          <Field
            pill
            label="Passwort"
            hint={Account.sentence["password-needed"]}
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
        ) : null}
        <ProblemText reason={reasonOf(result)} />
        <Button
          kind="action"
          label="Bestätigen"
          block
          disabled={!complete}
          busy={result.waiting}
          onPress={() => void submit()}
        />
        <View style={styles.center}>
          <Link
            variant="subhead"
            label={resent._tag === "Success" ? "Code ist unterwegs" : "Neuen Code schicken"}
            busy={resent.waiting}
            onPress={() => sendCode(email)}
          />
        </View>
        <ProblemText reason={reasonOf(resent)} />
        <Button
          kind="secondary"
          label="Andere E-Mail-Adresse verwenden"
          block
          onPress={otherAddress}
        />
      </Form>
      <OtherWay
        label="Abbrechen"
        href="/aktivieren"
        back
        onPress={() => {
          keepReservation(Option.none());
          cancel();
        }}
      />
    </>
  );
}

/**
 * "Geschafft!": the confirmed session waits here for a passkey or "Später". Leaving any other way
 * counts as "Später", except on a public computer, where it ends the session.
 */
export function PasskeyOfferScreen() {
  return Option.match(AccountState.useConfirmed(), {
    onNone: () => <Redirect href="/aktivieren" />,
    onSome: ({ email }) => <PasskeyOffer key={email} email={email} />,
  });
}

function PasskeyOffer({ email }: { readonly email: string }) {
  const [result, finish] = useAtom(AccountState.finish, { mode: "promiseExit" });

  AccountState.useLaterOnLeave(email);

  return (
    <>
      <AuthHeading>Geschafft!</AuthHeading>
      <Form>
        <PasskeyLead>
          Mit einem Passkey meldest du dich künftig mit Face ID, deinem Fingerabdruck oder der
          Geräte-PIN an. Ein Passwort brauchst du dann nicht mehr.
        </PasskeyLead>
        <ProblemText reason={reasonOf(result)} />
        <Button
          kind="action"
          label="Passkey anlegen"
          block
          busy={result.waiting}
          onPress={() => void finish({ email, withPasskey: true })}
        />
        <Button
          kind="secondary"
          label="Später"
          block
          onPress={() => void finish({ email, withPasskey: false })}
        />
      </Form>
    </>
  );
}

/**
 * The code as typed, digits only and at most six, so a pasted "145 838" becomes "145838".
 * `onEdit` runs when it changes, so an answer about the old code goes.
 */
export function useCode(onEdit: () => void) {
  const [value, setValue] = useState("");

  return {
    value,
    set: (text: string) => {
      const next = text.replaceAll(/\D/gu, "").slice(0, codeLength);

      if (next !== value) onEdit();
      setValue(next);
    },
  };
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
});
