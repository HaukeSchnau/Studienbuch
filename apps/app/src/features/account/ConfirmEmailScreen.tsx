import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Accounts } from "@stu/api/Accounts";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Field } from "@stu/ui/Field";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { Redirect, useRouter } from "expo-router";
import { Keyboard, StyleSheet } from "react-native";

import { publicComputer } from "../../infra/device/publicComputer.ts";
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
import { CodeField, ResendCode, useCode } from "./CodeField.tsx";
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
  const [resent, sendCode] = useAtom(AccountState.sendCode, { mode: "promiseExit" });
  const cancel = useAtomSet(AccountState.cancelSignUp);
  const keepReservation = useAtomSet(Steps.reservation);
  const keepEmail = useAtomSet(Steps.signUpEmail);
  const keepCode = useAtomSet(Steps.accessCode);

  // After a reload or a restart the device no longer holds the password it signed up with.
  const asksPassword = Option.isNone(waiting.password);
  const complete = code.complete && (!asksPassword || password.length > 0);

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
      keepEmail(Option.none());
      keepCode(Option.none());
      router.push("/geschafft");
    }
  };

  // Another address, or this one with a typo fixed, takes the same code's reservation back to
  // "Konto erstellen", which shows this address to correct.
  const otherAddress = () => {
    keepReservation(Option.some(waiting.reservation));
    keepEmail(Option.some(email));
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
            invalid={Option.contains(reasonOf(result), "password-mismatch")}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              forget(Atom.Reset);
            }}
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
        <ResendCode
          result={resent}
          send={() => sendCode(email).then(Exit.isSuccess)}
          onSent={() => {
            code.clear();
            forget(Atom.Reset);
          }}
        />
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
          keepEmail(Option.none());
          keepCode(Option.none());
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
  const { color } = Theme.useTheme();
  const [result, finish] = useAtom(AccountState.finish, { mode: "promiseExit" });
  const offDevice = useAtomValue(publicComputer);
  const attempting = AccountState.useAttempting();

  AccountState.useLaterOnLeave(email);

  return (
    <>
      <AuthHeading>Geschafft!</AuthHeading>
      <Form>
        <PasskeyLead>
          {offDevice
            ? "Mit einem Passkey auf deinem Handy oder einem Sicherheitsschlüssel meldest du dich künftig ohne Passwort an. Dieser Computer speichert ihn nicht."
            : "Mit einem Passkey meldest du dich künftig mit Face ID, deinem Fingerabdruck oder der Geräte-PIN an. Ein Passwort brauchst du dann nicht mehr."}
        </PasskeyLead>
        <ProblemText reason={reasonOf(result)} />
        <Button
          kind="action"
          label="Passkey anlegen"
          block
          busy={result.waiting}
          disabled={attempting}
          onPress={() => void finish({ email, withPasskey: true })}
        />
        <Button
          kind="secondary"
          label="Später"
          block
          disabled={attempting}
          onPress={() => void finish({ email, withPasskey: false })}
        />
        {/* A public computer starts no notebook key, so there is nothing to secure there yet. */}
        {offDevice ? null : (
          <Text variant="subhead" style={[styles.later, { color: color.inkSoft }]}>
            Ohne Passkey ist dein Notizbuch noch nicht abgesichert und hängt nur an diesem Gerät.
            Eine Notfallkarte erstellst du später unter „Dieses Gerät“, oben rechts auf der
            Übersicht.
          </Text>
        )}
      </Form>
    </>
  );
}

const styles = StyleSheet.create({
  later: { textAlign: "center" },
});
