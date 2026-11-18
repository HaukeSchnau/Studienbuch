import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Accounts } from "@stu/api/Accounts";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Field } from "@stu/ui/Field";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Keyboard } from "react-native";

import { PublicComputerChoice } from "../keys/PublicComputerChoice.tsx";
import {
  Done,
  Form,
  OtherWay,
  ProblemText,
  reasonOf,
  Strong,
  useCredentials,
  useRunning,
} from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { CodeField, ResendCode, useCode, useForgetAnswer } from "./CodeField.tsx";
import { Steps } from "./Steps.ts";

/**
 * "Passwort vergessen?", the old web's screen with a code instead of a link: the address first,
 * then, once the mail is on its way, the code and a new password in the same card, also after a
 * reload. A new password doesn't touch the notebook's key, so nothing on any device is lost.
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
  const sending = useRunning(AccountState.requestPasswordReset);
  const keep = useAtomSet(Steps.resetSentTo);

  const submit = async () => {
    if (sending()) return;

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
          invalid={Option.contains(reasonOf(sent), "invalid-email")}
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
 * that, as offline or after too many requests, the reason shows under the link. Saving signs in,
 * so the choice of a public computer shows here as on "Anmelden". A signed-out device holds no
 * notebook key, so the home it lands on is locked, and this step says so first.
 */
function NewPassword({ email }: { readonly email: string }) {
  const { color } = Theme.useTheme();
  const [result, reset] = useAtom(AccountState.resetPassword, { mode: "promiseExit" });
  const keepSentTo = useAtomSet(Steps.resetSentTo);
  const keepTyped = useAtomSet(Steps.forgotten);
  const forgetResult = useForgetAnswer(AccountState.resetPassword);
  const code = useCode(forgetResult);
  const { password, setPassword } = useCredentials();
  const [resent, request] = useAtom(AccountState.requestPasswordReset, { mode: "promiseExit" });
  const short = password.length < Accounts.minPasswordLength;
  const complete = code.complete && !short;
  const attempting = AccountState.useAttempting();
  const saving = AccountState.useSigningIn(result);

  const submit = async () => {
    if (!complete || attempting) return;

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
        <PublicComputerChoice />
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
        <Text variant="subhead" style={{ color: color.inkSoft }}>
          Ein neues Passwort öffnet dein Notizbuch nicht. Danach entsperrst du es auf diesem Gerät
          mit deinem Passkey oder deiner Notfallkarte.
        </Text>
        <ProblemText reason={reasonOf(result)} />
        <Button
          kind="action"
          label="Passwort speichern"
          block
          disabled={!complete || attempting}
          busy={saving}
          onPress={() => void submit()}
        />
        <ResendCode
          result={resent}
          send={() => request(email).then(Exit.isSuccess)}
          onSent={() => {
            code.clear();
            forgetResult();
          }}
        />
      </Form>
      <OtherWay label="Zurück zur Anmeldung" href="/anmelden" back />
    </>
  );
}
