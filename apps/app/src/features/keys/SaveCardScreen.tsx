import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { AuthHeading } from "@stu/ui/AuthHeading";
import { Button } from "@stu/ui/Button";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

import { LeaveWarning } from "../../infra/device/LeaveWarning.tsx";
import { AuthShell } from "../../ui/AuthShell.tsx";
import { Form, Lead, PasskeyLead, ProblemText, reasonOf } from "../account/AccountForm.tsx";
import { AccountState } from "../account/AccountState.ts";
import { CardCode, CardCodeField, KeyProblemBox, keyReasonOf } from "./KeysUi.tsx";
import { KeysState } from "./KeysState.ts";
import { NotebookKeys } from "./NotebookKeys.ts";
import { useTypedCode } from "./RecoveryCodeScreen.tsx";

type Step = "card" | "passkey" | "read-back";

/**
 * Where the card step is. Only the card survives a restart (`KeysState.pendingCard`), so the
 * step starts at the card again.
 */
export function useCardStep() {
  return useState<Step>("card");
}

/**
 * "Deine Notfallkarte" after a sign-up without an address. The card is the account's way back, so
 * nothing skips this step. What follows is `NotebookKeys.afterSaved`: a passkey offer, then
 * typing the code back once (D97 Q7), which also signs in with it.
 */
export function SaveCardScreen({
  accountId,
  card,
}: {
  readonly accountId: string;
  readonly card: NotebookKeys.PendingCard;
}) {
  const [step, setStep] = useCardStep();
  const keepsNothing = AsyncResult.getOrElse(useAtomValue(AccountState.keepsNothing), () => false);

  return (
    <AuthShell>
      {/* Only the tab's memory holds the card on a public computer. */}
      <LeaveWarning active={keepsNothing} />
      {step === "card" ? (
        <ShowCard accountId={accountId} card={card} onSaved={setStep} />
      ) : step === "passkey" ? (
        <OfferPasskey accountId={accountId} onLater={() => setStep("read-back")} />
      ) : (
        <ReadBack accountId={accountId} onShowAgain={() => setStep("card")} />
      )}
    </AuthShell>
  );
}

/**
 * The device couldn't keep or read the new account's card. The step waits with a retry rather
 * than letting the first start go on without the card.
 */
export function CardTrouble({ accountId }: { readonly accountId: string }) {
  const retry = useAtomSet(KeysState.retryCard(accountId));

  return (
    <AuthShell>
      <AuthHeading>Deine Notfallkarte</AuthHeading>
      <Lead>
        Dieses Gerät konnte deine Notfallkarte gerade nicht speichern oder lesen. Ohne sie geht es
        nicht weiter, denn sie ist der Weg zurück in dein Konto.
      </Lead>
      <Form>
        <Button kind="action" label="Noch einmal versuchen" block onPress={() => retry()} />
      </Form>
    </AuthShell>
  );
}

function ShowCard({
  accountId,
  card,
  onSaved,
}: {
  readonly accountId: string;
  readonly card: NotebookKeys.PendingCard;
  readonly onSaved: (next: "passkey" | "read-back") => void;
}) {
  const { color } = Theme.useTheme();
  const keepsNothing = AsyncResult.getOrElse(useAtomValue(AccountState.keepsNothing), () => false);
  const [sent, send] = useAtom(KeysState.saveCard(accountId), { mode: "promiseExit" });

  const [released, release] = useAtom(KeysState.cardSaved(accountId), {
    mode: "promiseExit",
  });

  const [passkey, withPasskey] = useAtom(KeysState.withPasskey(accountId), { mode: "promiseExit" });
  const [left, leave] = useAtom(KeysState.leaveCard(accountId), { mode: "promiseExit" });
  const notFresh = Option.contains(keyReasonOf(sent), "not-fresh");
  const replaced = Option.contains(keyReasonOf(sent), "no-match");

  const saved = async () => {
    const exit = await send();

    if (Exit.isFailure(exit)) return;

    const next = NotebookKeys.afterSaved(card, keepsNothing);

    if (next === "done") await release();
    else onSaved(next);
  };

  // The server retired this card for a newer one, which the student saw on the device that made it.
  if (replaced) {
    return (
      <>
        <AuthHeading>Deine Notfallkarte</AuthHeading>
        <Lead>
          Auf einem anderen Gerät hast du inzwischen eine neue Notfallkarte erstellt. Diese hier
          gilt deshalb nicht mehr. Heb die neue auf.
        </Lead>
        <Form>
          <KeyProblemBox reason={keyReasonOf(left)} />
          <Button
            kind="action"
            label="Weiter"
            block
            busy={left.waiting}
            onPress={() => void leave(card)}
          />
        </Form>
      </>
    );
  }

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
        {/* The browser's own question before a reload can't say this. Only a card-first sign-up's
            card is its new account's way in; a new card for an existing one loses its code. */}
        {keepsNothing ? (
          <Text variant="subhead" style={[styles.center, { color: color.danger }]}>
            {card.endsAtSaved
              ? "Auf diesem öffentlichen Computer gibt es diesen Code nur in diesem Tab. Lädst du die Seite neu oder schließt du den Tab, bevor du ihn aufgeschrieben hast, ist er weg. Deine alte Notfallkarte gilt dann trotzdem nicht mehr."
              : "Auf diesem öffentlichen Computer gibt es die Karte nur in diesem Tab. Lädst du die Seite neu oder schließt du den Tab, bevor du sie aufgeschrieben hast, ist dein neues Konto verloren. Für ein neues brauchst du dann einen Zugangscode, der noch gilt."}
          </Text>
        ) : null}
        <KeyProblemBox
          reason={Option.filter(keyReasonOf(sent), (reason) => reason !== "not-fresh")}
        />
        {/* A card-only account's stale sign-in signs in again with the card, which can fail too. */}
        <ProblemText reason={reasonOf(sent)} />
        {notFresh ? (
          // Only after a first send that failed, once the sign-in is stale, and only with a
          // passkey: a card-only account signs in again with this card.
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
  const [added, addPasskey] = useAtom(KeysState.addPasskey(accountId), { mode: "promiseExit" });

  const [released, release] = useAtom(KeysState.cardSaved(accountId), {
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
          Mit einem Passkey meldest du dich mit Face ID, deinem Fingerabdruck oder deinem Handy an.
          Die Notfallkarte brauchst du dann nur noch im Notfall.
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
