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
import { Keyboard, StyleSheet, View } from "react-native";

import {
  Done,
  Form,
  OtherWay,
  ProblemText,
  reasonOf,
  Strong,
  useCredentials,
} from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { CodeField, codeLength } from "./CodeField.tsx";
import { useCode } from "./ConfirmEmailScreen.tsx";
import { Steps } from "./Steps.ts";

/**
 * "Passwort vergessen?", the old web's screen with a code instead of a link: the address first,
 * then, once the mail is on its way, the code and a new password in the same card. A new password
 * doesn't touch the notebook's key, so nothing on any device is lost.
 */
export function ForgotPasswordScreen() {
  return Option.match(useAtomValue(Steps.resetSentTo), {
    onNone: () => <Address />,
    onSome: (email) => <NewPassword email={email} />,
  });
}

function Address() {
  const typed = Option.getOrElse(useAtomValue(Steps.forgotten), () => "");
  const { email, setEmail } = useCredentials(typed);
  const [sent, request] = useAtom(AccountState.requestPasswordReset, { mode: "promiseExit" });
  const keep = useAtomSet(Steps.resetSentTo);

  const submit = async () => {
    Keyboard.dismiss();

    const exit = await request(email.trim());

    if (Exit.isSuccess(exit)) keep(Option.some(email.trim()));
  };

  return (
    <>
      <AuthHeading>Passwort vergessen?</AuthHeading>
      <Form>
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
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <ProblemText reason={reasonOf(sent)} />
        <Button
          kind="action"
          label={sent.waiting ? "Wird geschickt …" : "Code schicken"}
          block
          disabled={email.trim() === ""}
          busy={sent.waiting}
          onPress={() => void submit()}
        />
      </Form>
      <OtherWay label="Zurück zur Anmeldung" href="/anmelden" back />
    </>
  );
}

/**
 * The code and the new password. Asking for another code stays here, and when the server refuses
 * that, as offline or after too many requests, the reason shows under the link.
 */
function NewPassword({ email }: { readonly email: string }) {
  const [result, reset] = useAtom(AccountState.resetPassword, { mode: "promiseExit" });
  const forget = useAtomSet(AccountState.resetPassword);
  const keepSentTo = useAtomSet(Steps.resetSentTo);
  const keepTyped = useAtomSet(Steps.forgotten);
  const code = useCode(() => forget(Atom.Reset));
  const { password, setPassword } = useCredentials();
  const [resent, request] = useAtom(AccountState.requestPasswordReset);
  const short = password.length < Accounts.minPasswordLength;
  const complete = code.value.length === codeLength && !short;

  const submit = async () => {
    if (!complete) return;

    Keyboard.dismiss();

    const exit = await reset({ email, code: code.value, password });

    // Signed in: the address leaves memory.
    if (Exit.isSuccess(exit)) {
      keepSentTo(Option.none());
      keepTyped(Option.none());
    }
  };

  return (
    <>
      <Done title="Unterwegs zu dir">
        Falls ein Konto zu <Strong>{email}</Strong> gehört, haben wir einen Code geschickt. Er gilt{" "}
        {Accounts.codeMinutes} Minuten.
      </Done>
      <Form>
        <CodeField value={code.value} onChangeText={code.set} />
        <Field
          pill
          label="Neues Passwort"
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
        <Button
          kind="action"
          label="Passwort speichern"
          block
          disabled={!complete}
          busy={result.waiting}
          onPress={() => void submit()}
        />
        <View style={styles.center}>
          <Link
            variant="subhead"
            label={AsyncResult.isSuccess(resent) ? "Code ist unterwegs" : "Neuen Code schicken"}
            busy={resent.waiting}
            onPress={() => request(email)}
          />
        </View>
        <ProblemText reason={reasonOf(resent)} />
      </Form>
      <OtherWay label="Zurück zur Anmeldung" href="/anmelden" back />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
});
