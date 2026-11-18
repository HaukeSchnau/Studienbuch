import { useAtom, useAtomValue } from "@effect/atom-react";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

import { publicComputer } from "../../infra/device/publicComputer.ts";
import { AuthShell } from "../../ui/AuthShell.tsx";
import { Form, Lead, PasskeyLead, ProblemText, reasonOf } from "../account/AccountForm.tsx";
import { CardCode, CardCodeField, KeyProblemBox, keyReasonOf } from "./KeysUi.tsx";
import { KeysState } from "./KeysState.ts";
import type { NotebookKeys } from "./NotebookKeys.ts";
import { useTypedCode } from "./RecoveryCodeScreen.tsx";

type Step = "card" | "passkey" | "read-back";

/**
 * Where the card step is. Only the card survives a restart (`KeysState.unsavedCard`), so the
 * step starts at the card again.
 */
export function useCardStep() {
  return useState<Step>("card");
}

/**
 * "Deine Notfallkarte" after a sign-up without an address. The card is the account's way back, so
 * nothing skips this step. An account without a passkey is offered one next, and without it the
 * student types the code back once (D97 Q7), which also signs in with it.
 */
export function SaveCardScreen({
  accountId,
  card,
}: {
  readonly accountId: string;
  readonly card: NotebookKeys.UnsavedCard;
}) {
  const [step, setStep] = useCardStep();

  return (
    <AuthShell>
      {step === "card" ? (
        <ShowCard accountId={accountId} card={card} onSaved={() => setStep("passkey")} />
      ) : step === "passkey" ? (
        <OfferPasskey accountId={accountId} onLater={() => setStep("read-back")} />
      ) : (
        <ReadBack accountId={accountId} onShowAgain={() => setStep("card")} />
      )}
    </AuthShell>
  );
}

function ShowCard({
  accountId,
  card,
  onSaved,
}: {
  readonly accountId: string;
  readonly card: NotebookKeys.UnsavedCard;
  readonly onSaved: () => void;
}) {
  const { color } = Theme.useTheme();
  const [sent, send] = useAtom(KeysState.sendUnsavedCard(accountId), { mode: "promiseExit" });

  const [released, release] = useAtom(KeysState.releaseUnsavedCard(accountId), {
    mode: "promiseExit",
  });

  const [passkey, withPasskey] = useAtom(KeysState.withPasskey(accountId), { mode: "promiseExit" });
  const notFresh = Option.contains(keyReasonOf(sent), "not-fresh");

  const saved = async () => {
    const exit = await send();

    if (Exit.isFailure(exit)) return;

    // With a passkey, the card was the last step; without, the passkey offer follows.
    if (card.withPasskey) await release();
    else onSaved();
  };

  return (
    <>
      <AuthHeading>Deine Notfallkarte</AuthHeading>
      <Lead>
        Mit diesem Code kommst du in dein Konto und an dein Notizbuch, auch auf einem neuen Gerät.
        Wer ihn hat, kommt auch hinein.
      </Lead>
      <Form>
        <CardCode text={card.text} />
        <Text variant="subhead" style={[styles.center, { color: color.inkSoft }]}>
          Schreib ihn ab und heb ihn gut auf, zum Beispiel bei deinen Zeugnissen. Kein Screenshot:
          Fotos sieht jeder, der dein entsperrtes Gerät hat.
        </Text>
        <KeyProblemBox
          reason={Option.filter(keyReasonOf(sent), (reason) => reason !== "not-fresh")}
        />
        {notFresh ? (
          // Only an account with a passkey gets here: a card-only one signs in with this card.
          <>
            <Text variant="subhead">
              Bestätige kurz mit deinem Passkey, dann gilt deine Notfallkarte.
            </Text>
            <Button
              kind="secondary"
              label="Mit Passkey bestätigen"
              block
              busy={passkey.waiting}
              onPress={() =>
                void withPasskey().then((exit) => (Exit.isSuccess(exit) ? saved() : undefined))
              }
            />
            <ProblemText reason={reasonOf(passkey)} />
          </>
        ) : null}
        <KeyProblemBox reason={keyReasonOf(released)} />
        <Button
          kind="action"
          label="Ich habe ihn aufgeschrieben"
          block
          busy={sent.waiting || released.waiting}
          onPress={() => void saved()}
        />
      </Form>
    </>
  );
}

function OfferPasskey({
  accountId,
  onLater,
}: {
  readonly accountId: string;
  readonly onLater: () => void;
}) {
  const offDevice = useAtomValue(publicComputer);
  const [added, addPasskey] = useAtom(KeysState.addPasskey(accountId), { mode: "promiseExit" });

  const [released, release] = useAtom(KeysState.releaseUnsavedCard(accountId), {
    mode: "promiseExit",
  });

  const add = async () => {
    if (Exit.isSuccess(await addPasskey())) await release();
  };

  return (
    <>
      <AuthHeading>Schneller anmelden</AuthHeading>
      <Form>
        <PasskeyLead>
          {offDevice
            ? "Mit einem Passkey auf deinem Handy oder einem Sicherheitsschlüssel meldest du dich schneller an. Dieser Computer speichert ihn nicht. Die Notfallkarte brauchst du dann nur noch im Notfall."
            : "Mit einem Passkey meldest du dich mit Face ID, deinem Fingerabdruck oder deinem Handy an. Die Notfallkarte brauchst du dann nur noch im Notfall."}
        </PasskeyLead>
        <ProblemText reason={reasonOf(added)} />
        <KeyProblemBox reason={Option.orElse(keyReasonOf(added), () => keyReasonOf(released))} />
        <Button
          kind="action"
          label="Passkey anlegen"
          block
          busy={added.waiting || released.waiting}
          onPress={() => void add()}
        />
        <Button kind="secondary" label="Später" block onPress={onLater} />
      </Form>
    </>
  );
}

function ReadBack({
  accountId,
  onShowAgain,
}: {
  readonly accountId: string;
  readonly onShowAgain: () => void;
}) {
  const [code, setCode] = useTypedCode();
  const [checked, check] = useAtom(KeysState.readBack(accountId), { mode: "promiseExit" });
  const reason = keyReasonOf(checked);

  // Once the code checks out the device forgets the card, and the gate moves on.
  const submit = () => {
    Keyboard.dismiss();
    void check(code);
  };

  return (
    <>
      <AuthHeading>Einmal abtippen</AuthHeading>
      <Lead>
        Tipp den Code von deiner Karte einmal ab. So weißt du, dass du ihn richtig aufgeschrieben
        hast und dass er dich anmeldet.
      </Lead>
      <Form>
        <CardCodeField
          pill
          value={code}
          onChangeText={setCode}
          onSubmitEditing={submit}
          invalid={Option.isSome(reason) || Option.isSome(reasonOf(checked))}
        />
        <KeyProblemBox reason={reason} />
        <ProblemText reason={reasonOf(checked)} />
        <Button
          kind="action"
          label="Prüfen"
          block
          busy={checked.waiting}
          disabled={code.trim() === ""}
          onPress={submit}
        />
      </Form>
      <View style={styles.again}>
        <Link label="Code noch einmal zeigen" variant="subhead" onPress={onShowAgain} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  again: { alignItems: "center", marginTop: 20 },
});
