import { useAtom, useAtomValue } from "@effect/atom-react";
import type { Access } from "@stu/api/Access";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";

import { publicComputer } from "../../infra/device/publicComputer.ts";
import { RouteLink } from "../../ui/navigation/RouteLink.tsx";
import { PublicComputerChoice } from "../keys/PublicComputerChoice.tsx";
import { AccessCode } from "./AccessCode.ts";
import { Form, Lead, OtherWay, PasskeyLead, ProblemText, reasonOf } from "./AccountForm.tsx";
import { AccountState } from "./AccountState.ts";
import { Steps } from "./Steps.ts";

/**
 * "Konto anlegen": an account without an email address (D97). It starts with a passkey, one prompt,
 * where the device can keep one; on a public computer or a device without passkeys it starts with
 * the Notfallkarte. Either way the card follows as the account's way back. The email sign-up
 * stays one link below.
 */
export function CreateAccountScreen() {
  // Without a redeemed code there is nothing to sign up for: the code comes first.
  return Option.match(useAtomValue(Steps.reservation), {
    onNone: () => <Redirect href="/aktivieren" />,
    onSome: (reservation) => <Choose reservation={reservation} />,
  });
}

function Choose({ reservation }: { readonly reservation: Access.Reservation }) {
  const { color } = Theme.useTheme();
  const offDevice = useAtomValue(publicComputer);
  const here = useAtomValue(AccountState.passkeysHere);
  const [passkey, signUpWithPasskey] = useAtom(AccountState.signUpWithPasskey);
  const [card, signUpWithCard] = useAtom(AccountState.signUpWithCard);

  // A device that can't say counts as one without passkeys: the card works everywhere.
  const withPasskey = !offDevice && AsyncResult.getOrElse(here, () => false);
  const asking = !offDevice && AsyncResult.isInitial(here);

  // A passkey that didn't work, or one the student closed, leaves the card as the way in.
  const passkeyFailed = AsyncResult.isFailure(passkey);
  const reason = Option.orElse(reasonOf(card), () => reasonOf(passkey));
  const busy = passkey.waiting || card.waiting;

  return (
    <>
      <AuthHeading>Konto anlegen</AuthHeading>
      <Lead>{AccessCode.describe(reservation)}</Lead>
      <Form>
        <PublicComputerChoice />
        {asking ? null : withPasskey ? (
          <PasskeyLead>
            Für Studienbuch brauchst du keine E-Mail-Adresse. Du meldest dich mit Face ID, deinem
            Fingerabdruck oder der Geräte-PIN an, und deine Notfallkarte bringt dich zurück, wenn
            der Passkey einmal fehlt.
          </PasskeyLead>
        ) : (
          <Text style={[styles.center, { color: color.inkSoft }]}>
            Für Studienbuch brauchst du keine E-Mail-Adresse. Dein Konto hängt an deiner
            Notfallkarte und, wenn du magst, an einem Passkey.
          </Text>
        )}
        <ProblemText reason={reason} />
        {Option.contains(reason, "reservation-refused") ? (
          <View style={styles.center}>
            <RouteLink
              label="Zugangscode eingeben"
              variant="subhead"
              href="/aktivieren"
              dismissTo
            />
          </View>
        ) : null}
        {withPasskey ? (
          <Button
            kind="action"
            label={passkey.waiting ? "Konto wird angelegt …" : "Konto mit Passkey anlegen"}
            block
            busy={passkey.waiting}
            disabled={busy}
            onPress={() => signUpWithPasskey(reservation)}
          />
        ) : null}
        {asking ? null : !withPasskey || passkeyFailed ? (
          <Button
            kind={withPasskey ? "secondary" : "action"}
            label={card.waiting ? "Konto wird angelegt …" : "Notfallkarte erstellen"}
            block
            busy={card.waiting}
            disabled={busy}
            onPress={() => signUpWithCard(reservation)}
          />
        ) : null}
      </Form>
      <View style={styles.email}>
        <RouteLink label="Lieber mit E-Mail-Adresse" variant="subhead" href="/konto-erstellen" />
      </View>
      <OtherWay question="Schon ein Konto?" label="Anmelden" href="/anmelden" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", textAlign: "center" },
  email: { alignItems: "center", marginTop: 20 },
});
