import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { Field } from "@stu/ui/Field";
import { Icon } from "@stu/ui/Icon";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as DateTime from "effect/DateTime";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { ProblemText, reasonOf, reasonOfExit, useCredentials } from "../account/AccountForm.tsx";
import { KeyProblem, keyReasonOf, keyReasonOfExit, MethodRow, type Glyph } from "./KeysUi.tsx";
import { KeysState } from "./KeysState.ts";
import type { NotebookKeys } from "./NotebookKeys.ts";

/** "Notizbuch-Schlüssel": what happens if this device is gone, and the methods that answer it. */
export function KeysScreen() {
  const account = KeysState.useAccountId();

  return Option.match(account, {
    onNone: () => <Redirect href="/anmelden" />,
    onSome: (accountId) => <Keys accountId={accountId} />,
  });
}

/** What waits for a fresh sign-in. */
type Waiting = "code" | "passkey";

/**
 * The screen's own memory: a new Notfallkarte's text while it shows, which nothing stores, and the
 * action that waits for the student to sign in again.
 */
export function useKeysScreenState() {
  const [card, setCard] = useState(Option.none<Redacted.Redacted>());
  const [waiting, setWaiting] = useState(Option.none<Waiting>());
  const [passkeyResult, setPasskeyResult] = useState(Option.none<KeysState.NewPasskey>());

  return { card, setCard, waiting, setWaiting, passkeyResult, setPasskeyResult };
}

const day = (since: DateTime.Utc) =>
  DateTime.formatLocal(since, {
    locale: "de-DE",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** What a row says about one method. */
interface MethodText {
  readonly glyph: Glyph;
  readonly title: string;
  readonly detail: string;
}

const row = (method: NotebookKeys.Method): MethodText => {
  const since = day(method.since);

  switch (method.kind) {
    case "device":
      return method.thisDevice
        ? { glyph: "device", title: "Dieses Gerät", detail: `seit ${since}` }
        : { glyph: "device", title: "Weiteres Gerät", detail: `seit ${since}` };
    case "prf":
      return { glyph: "passkey", title: "Passkey", detail: `Öffnet dein Notizbuch, seit ${since}` };
    case "code":
      return { glyph: "code", title: "Notfallkarte", detail: `Erstellt am ${since}` };
  }
};

function Keys({ accountId }: { readonly accountId: string }) {
  const screen = useKeysScreenState();

  return Option.match(screen.card, {
    onSome: (card) => <NewCard text={card} onDone={() => screen.setCard(Option.none())} />,
    onNone: () => <Overview accountId={accountId} screen={screen} />,
  });
}

function Overview({
  accountId,
  screen,
}: {
  readonly accountId: string;
  readonly screen: ReturnType<typeof useKeysScreenState>;
}) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const summary = useAtomValue(KeysState.summary(accountId));

  const [created, createCard] = useAtom(KeysState.createRecoveryCode(accountId), {
    mode: "promiseExit",
  });

  const [added, addPasskey] = useAtom(KeysState.addPasskey(accountId), { mode: "promiseExit" });

  const newCard = async () => {
    const exit = await createCard();

    if (Exit.isSuccess(exit)) return screen.setCard(Option.some(exit.value));

    if (Option.contains(keyReasonOfExit(exit), "not-fresh")) screen.setWaiting(Option.some("code"));
  };

  const newPasskey = async () => {
    const exit = await addPasskey();

    if (Exit.isSuccess(exit)) return screen.setPasskeyResult(Option.some(exit.value));

    const stale =
      Option.contains(reasonOfExit(exit), "not-fresh") ||
      Option.contains(keyReasonOfExit(exit), "not-fresh");

    if (stale) screen.setWaiting(Option.some("passkey"));
  };

  const retry = () => {
    const waited = screen.waiting;

    screen.setWaiting(Option.none());

    if (Option.contains(waited, "code")) void newCard();

    if (Option.contains(waited, "passkey")) void newPasskey();
  };

  return (
    <HeroScreen title="Notizbuch-Schlüssel" subtitle="Wenn du dieses Gerät verlierst">
      {AsyncResult.match(summary, {
        onInitial: () => null,
        onFailure: () => (
          <Card padded>
            {Option.isNone(keyReasonOf(summary)) ? (
              <Text variant="subhead" style={{ color: color.danger }}>
                Das hat nicht geklappt. Versuch es noch einmal.
              </Text>
            ) : null}
            <KeyProblem reason={keyReasonOf(summary)} />
            {Option.contains(keyReasonOf(summary), "locked") ? (
              <Link
                label="Notizbuch entsperren"
                onPress={() => router.push("/notizbuch-entsperren")}
              />
            ) : null}
          </Card>
        ),
        onSuccess: ({ value }) => (
          <>
            <Card padded>
              <View style={styles.status}>
                <Icon
                  name={value.secured ? "checkBadge" : "alert"}
                  color={value.secured ? color.accent : color.warning}
                  size={28}
                />
                <View style={styles.grow}>
                  <Text
                    variant="title2"
                    style={{ color: value.secured ? color.accent : color.warning }}
                  >
                    {value.secured ? "Abgesichert" : "Nicht abgesichert"}
                  </Text>
                  <Text variant="subhead" style={{ color: color.inkSoft }}>
                    {value.secured
                      ? "Du kommst auch ohne dieses Gerät an dein Notizbuch."
                      : "Dein Notizbuch hängt an diesem Gerät. Geht es verloren, sind deine Hausaufgaben weg. Niemand kann sie zurückholen, auch Studienbuch nicht."}
                  </Text>
                </View>
              </View>
            </Card>
            <Card padded title="Damit kommst du rein">
              <View>
                {value.methods.map((method, index) => (
                  // oxlint-disable-next-line react/no-array-index-key -- methods have no id of their own here, and their order is the server's.
                  <MethodRow key={index} {...row(method)} />
                ))}
              </View>
            </Card>
          </>
        ),
      })}
      {/* The actions need the device's key, which the summary waits for. */}
      {!AsyncResult.isSuccess(summary) ? null : Option.isSome(screen.waiting) ? (
        <Confirm accountId={accountId} onConfirmed={retry} />
      ) : (
        <View style={styles.actions}>
          <Button
            label="Notfallkarte erstellen"
            block
            busy={created.waiting}
            onPress={() => void newCard()}
          />
          <Button
            label="Passkey hinzufügen"
            kind="quiet"
            block
            busy={added.waiting}
            onPress={() => void newPasskey()}
          />
          <KeyProblem
            reason={Option.filter(
              Option.orElse(keyReasonOf(created), () => keyReasonOf(added)),
              (reason) => reason !== "not-fresh",
            )}
          />
          <ProblemText
            reason={Option.filter(reasonOf(added), (reason) => reason !== "not-fresh")}
          />
          {Option.match(screen.passkeyResult, {
            onNone: () => null,
            onSome: (result) => (
              <Text variant="subhead" style={{ color: color.inkSoft }}>
                {result === "opens"
                  ? "Passkey gespeichert. Er meldet dich an und öffnet dein Notizbuch."
                  : "Passkey gespeichert. Damit meldest du dich an. Dein Notizbuch kann er nicht öffnen, deshalb ist eine Notfallkarte wichtig."}
              </Text>
            ),
          })}
        </View>
      )}
    </HeroScreen>
  );
}

/** "Kurz bestätigen": a new sign-in, by passkey or password, before a new method. */
function Confirm({
  accountId,
  onConfirmed,
}: {
  readonly accountId: string;
  readonly onConfirmed: () => void;
}) {
  const { email, setEmail, password, setPassword, passwordField, toPassword } = useCredentials();
  const [passkey, withPasskey] = useAtom(KeysState.withPasskey(accountId), { mode: "promiseExit" });

  const [withPasswordResult, withPassword] = useAtom(KeysState.withPassword(accountId), {
    mode: "promiseExit",
  });

  const confirmed = (exit: Exit.Exit<unknown, unknown>) => {
    if (Exit.isSuccess(exit)) onConfirmed();
  };

  return (
    <Card padded title="Kurz bestätigen">
      <Text variant="subhead">
        Für eine neue Notfallkarte oder einen neuen Passkey meldest du dich einmal neu an. So kann
        niemand mit deinem entsperrten Gerät heimlich einen Weg in dein Notizbuch anlegen.
      </Text>
      <Button
        label="Mit Passkey bestätigen"
        block
        busy={passkey.waiting}
        onPress={() => void withPasskey().then(confirmed)}
      />
      <ProblemText reason={reasonOf(passkey)} />
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
        onSubmitEditing={() => {
          Keyboard.dismiss();
          void withPassword({ email, password }).then(confirmed);
        }}
      />
      <ProblemText reason={reasonOf(withPasswordResult)} />
      <Button
        label="Mit Passwort bestätigen"
        kind="quiet"
        block
        busy={withPasswordResult.waiting}
        onPress={() => {
          Keyboard.dismiss();
          void withPassword({ email, password }).then(confirmed);
        }}
      />
    </Card>
  );
}

/** "Deine Notfallkarte": the new code, shown this once. */
function NewCard({
  text,
  onDone,
}: {
  readonly text: Redacted.Redacted;
  readonly onDone: () => void;
}) {
  const { color } = Theme.useTheme();
  const groups = Redacted.value(text).split("-");

  return (
    <HeroScreen
      title="Deine Notfallkarte"
      subtitle="Damit öffnest du dein Notizbuch auf einem neuen Gerät."
    >
      <Card padded>
        <Text variant="footnote" style={{ color: color.accent }}>
          Studienbuch Notfallkarte
        </Text>
        <View accessible accessibilityLabel={`Code: ${groups.join(", ")}`}>
          <Text variant="title2" selectable style={styles.code}>
            {groups.slice(0, 4).join("-")}
          </Text>
          <Text variant="title2" selectable style={styles.code}>
            {groups.slice(4).join("-")}
          </Text>
        </View>
        <Text variant="footnote" style={{ color: color.inkSoft }}>
          Studienbuch fragt nie nach diesem Code. Gib ihn nur in der Studienbuch-App ein.
        </Text>
      </Card>
      <Text variant="subhead" style={[styles.note, { color: color.inkSoft }]}>
        Du siehst den Code nur jetzt. Schreib ihn ab und heb ihn bei deinen Zeugnissen auf. Kein
        Screenshot: Fotos sieht jeder, der dein entsperrtes Gerät hat.
      </Text>
      <View style={styles.actions}>
        <Button label="Fertig" block onPress={onDone} />
      </View>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", gap: Tokens.space.md, alignItems: "flex-start" },
  grow: { flex: 1, gap: Tokens.space.xs },
  actions: { gap: Tokens.space.md },
  note: { paddingHorizontal: Tokens.space.lg },
  code: { letterSpacing: 2, fontVariant: ["tabular-nums"] },
});
