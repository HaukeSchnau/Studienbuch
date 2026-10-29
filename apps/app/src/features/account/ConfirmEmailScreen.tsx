import { useAtom, useAtomValue } from "@effect/atom-react";
import { Accounts } from "@stu/api/Accounts";
import * as Option from "effect/Option";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { Text } from "../../ui/Text.tsx";
import { Account } from "./Account.ts";
import { PasskeyLead, ProblemText, reasonOf } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { CodeField, codeLength } from "./CodeField.tsx";
import { Button, Link, Section } from "./SharedUi.tsx";

/**
 * "E-Mail bestätigen": the six digits from the mail, then a passkey if the person wants one. The
 * offer shows only for the address on screen, so on a shared device the next person never sees
 * the previous one's.
 */
export function ConfirmEmailScreen() {
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const confirmed = Account.confirmedFor(useAtomValue(AccountState.confirmed), email);

  AccountState.useAbandonOnLeave();

  return Option.isSome(confirmed) ? <PasskeyOffer email={email} /> : <CodeEntry email={email} />;
}

function CodeEntry({ email }: { readonly email: string }) {
  const code = useCode();
  const [result, confirm] = useAtom(AccountState.confirmEmail);
  const [resent, sendCode] = useAtom(AccountState.sendCode);
  const complete = code.value.length === codeLength;

  const submit = () => {
    Keyboard.dismiss();
    confirm({ email, code: code.value });
  };

  return (
    <HeroScreen title="E-Mail bestätigen" subtitle="Fast geschafft.">
      <Section>
        <Text variant="callout">
          Wir haben einen Code an{" "}
          <Text variant="callout" style={styles.strong}>
            {email}
          </Text>{" "}
          geschickt. Er gilt {Accounts.codeMinutes} Minuten.
        </Text>
        <CodeField value={code.value} onChangeText={code.set} />
        <ProblemText reason={reasonOf(result)} />
        <Button
          label="Bestätigen"
          block
          disabled={!complete}
          busy={result.waiting}
          onPress={submit}
        />
        <View style={styles.center}>
          <Link
            label={resent._tag === "Success" ? "Code ist unterwegs" : "Neuen Code schicken"}
            busy={resent.waiting}
            onPress={() => sendCode(email)}
          />
        </View>
        <ProblemText reason={reasonOf(resent)} />
      </Section>
    </HeroScreen>
  );
}

function PasskeyOffer({ email }: { readonly email: string }) {
  const [result, finish] = useAtom(AccountState.finish);

  return (
    <HeroScreen title="Geschafft!" subtitle="Dein Konto ist bereit.">
      <Section title="Passkey anlegen?">
        <PasskeyLead>
          Mit einem Passkey meldest du dich künftig mit Face ID, deinem Fingerabdruck oder der
          Geräte-PIN an. Ein Passwort brauchst du dann nicht mehr.
        </PasskeyLead>
        <ProblemText reason={reasonOf(result)} />
        <Button
          label="Passkey anlegen"
          block
          busy={result.waiting}
          onPress={() => finish({ email, withPasskey: true })}
        />
        <Button
          kind="quiet"
          label="Später"
          block
          onPress={() => finish({ email, withPasskey: false })}
        />
      </Section>
    </HeroScreen>
  );
}

/** The code as typed, digits only and at most six, so a pasted "145 838" becomes "145838". */
export function useCode() {
  const [value, setValue] = useState("");

  return {
    value,
    set: (text: string) => setValue(text.replaceAll(/\D/gu, "").slice(0, codeLength)),
  };
}

const styles = StyleSheet.create({
  strong: { fontWeight: "700" },
  center: { alignItems: "center" },
});
