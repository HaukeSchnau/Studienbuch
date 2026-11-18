import { useAtom } from "@effect/atom-react";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import * as Option from "effect/Option";
import { Keyboard } from "react-native";

import { PublicComputerChoice } from "../keys/PublicComputerChoice.tsx";
import { CardCodeField, KeyProblemBox, keyReasonOf } from "../keys/KeysUi.tsx";
import { useTypedCode } from "../keys/RecoveryCodeScreen.tsx";
import { Form, Lead, OtherWay, ProblemText, reasonOf } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";

/**
 * "Mit Notfallkarte anmelden": the 28 characters sign in to an account without an address and open
 * its notebook in one go, on any device, a public computer included. A typo is caught on the
 * device, so it gets its answer offline.
 */
export function CardSignInScreen() {
  const [code, setCode] = useTypedCode();
  const [result, signIn] = useAtom(AccountState.signInWithCard, { mode: "promiseExit" });
  const keyReason = keyReasonOf(result);
  const reason = reasonOf(result);
  const attempting = AccountState.useAttempting();

  const submit = () => {
    if (code.trim() === "" || attempting) return;

    Keyboard.dismiss();
    void signIn(code);
  };

  return (
    <>
      <AuthHeading>Mit Notfallkarte anmelden</AuthHeading>
      <Lead>
        Tipp den Code von deiner Karte ein. Damit meldest du dich an und öffnest dein Notizbuch.
      </Lead>
      <Form>
        <PublicComputerChoice />
        <CardCodeField
          pill
          hint="Groß- und Kleinschreibung, Leerzeichen und Bindestriche sind egal."
          value={code}
          onChangeText={setCode}
          onSubmitEditing={submit}
          invalid={Option.isSome(keyReason) || Option.isSome(reason)}
        />
        <KeyProblemBox reason={keyReason} />
        <ProblemText reason={reason} />
        <Button
          kind="action"
          label={result.waiting ? "Anmeldung läuft …" : "Anmelden"}
          block
          disabled={code.trim() === "" || attempting}
          busy={result.waiting}
          onPress={submit}
        />
      </Form>
      <OtherWay label="Zurück zur Anmeldung" href="/anmelden" back />
    </>
  );
}
