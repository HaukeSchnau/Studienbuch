import { useAtomValue } from "@effect/atom-react";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Duration from "effect/Duration";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";

import { provider } from "../../infra/crypto/runtime.ts";
import { Card } from "../../ui/Card.tsx";
import { Text } from "../../ui/Text.tsx";
import { CryptoSelfTest } from "./CryptoSelfTest.ts";
import { SqliteSelfTest } from "./SqliteSelfTest.ts";
import { StatusRow, type Status } from "./StatusRow.tsx";

const milliseconds = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

const statusOf: Record<CryptoSelfTest.Outcome["status"], Status> = {
  passed: "ok",
  failed: "failed",
  unsupported: "missing",
};

/** Every check of the crypto self-test, with what it proved and how long it took. */
export function SelfTestScreen() {
  const { color } = Theme.useTheme();
  const outcomes = AsyncResult.value(useAtomValue(CryptoSelfTest.outcomes));
  const replay = useAtomValue(SqliteSelfTest.replay);
  const accountDatabase = useAtomValue(SqliteSelfTest.accountDatabase);

  const accentOf: Record<Status, string> = {
    ok: Tokens.subject.teal.fill,
    failed: color.danger,
    missing: color.warning,
    pending: color.inkSoft,
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {/* The overview below keeps its light status bar for the hero. */}
      <StatusBar style="auto" />
      <Text style={{ color: color.inkSoft }}>
        Bei jedem Start rechnet Studienbuch Testwerte aus den Standards nach. So fällt auf, wenn die
        Verschlüsselung auf einem Gerät falsch rechnet.
      </Text>
      <Text variant="footnote" style={{ color: color.inkSoft }}>
        Implementierung: {provider}
      </Text>
      {Option.match(outcomes, {
        onNone: () => <ActivityIndicator color={color.inkSoft} />,
        onSome: (all) => (
          <Card>
            {all.map((outcome, index) => (
              <StatusRow
                key={outcome.name}
                first={index === 0}
                label={`${milliseconds.format(Duration.toMillis(outcome.duration))} ms`}
                title={outcome.name}
                detail={outcome.detail}
                status={statusOf[outcome.status]}
                accent={accentOf[statusOf[outcome.status]]}
              />
            ))}
          </Card>
        ),
      })}
      <Text style={{ color: color.inkSoft }}>
        Die Datenbank dieses Geräts spielt die Fälle nach, in denen die Tests Gerät und Server
        vergleichen. Was hier anders endet, würde auf dem Gerät anders gespeichert als auf dem
        Server.
      </Text>
      <Card>
        {AsyncResult.matchWithError(replay, {
          onInitial: () => (
            <StatusRow
              first
              label="SQLite"
              title="Spielt die Fälle nach …"
              status="pending"
              accent={accentOf.pending}
            />
          ),
          onError: (error) => (
            <StatusRow
              first
              label="SQLite"
              title="Datenbank lässt sich nicht öffnen"
              detail={error._tag}
              status="failed"
              accent={accentOf.failed}
            />
          ),
          onDefect: (defect) => (
            <StatusRow
              first
              label="SQLite"
              title="Nachspielen abgebrochen"
              detail={String(defect)}
              status="failed"
              accent={accentOf.failed}
            />
          ),
          onSuccess: ({ value: [duration, results] }) => {
            const differing = results.filter((result) => !result.matches);
            const status: Status = differing.length === 0 ? "ok" : "failed";

            return [
              <StatusRow
                key="summary"
                first
                label={`${milliseconds.format(Duration.toMillis(duration))} ms`}
                title={`${results.length - differing.length} von ${results.length} Fällen wie in den Tests`}
                detail="Lesen, Schreiben und Ändern über den Tx des Geräts"
                status={status}
                accent={accentOf[status]}
              />,
              ...differing.map((result) => (
                <StatusRow
                  key={result.name}
                  label="Anders als in den Tests"
                  title={result.name}
                  detail={result.actual}
                  status="failed"
                  accent={accentOf.failed}
                />
              )),
            ];
          },
        })}
        {AsyncResult.matchWithError(accountDatabase, {
          onInitial: () => (
            <StatusRow
              label="Kontodatenbank"
              title="Wird angelegt …"
              status="pending"
              accent={accentOf.pending}
            />
          ),
          onError: (error) =>
            // An account's database is named after its server, so a build without one has no
            // account to sign in. The server row reports what's missing.
            error._tag === "ServerOrigin.NoServer" ? (
              <StatusRow
                label="Kontodatenbank"
                title="Übersprungen"
                detail="Ohne Server-Adresse meldet sich niemand an"
                status="missing"
                accent={accentOf.pending}
              />
            ) : (
              <StatusRow
                label="Kontodatenbank"
                title="Nicht angelegt"
                detail={error._tag}
                status="failed"
                accent={accentOf.failed}
              />
            ),
          onDefect: (defect) => (
            <StatusRow
              label="Kontodatenbank"
              title="Abgebrochen"
              detail={String(defect)}
              status="failed"
              accent={accentOf.failed}
            />
          ),
          onSuccess: ({ value: [duration, count] }) => (
            <StatusRow
              label={`${milliseconds.format(Duration.toMillis(duration))} ms`}
              title={`${count} Tabellen, Sichten und Indizes`}
              detail="Angelegt wie bei der Anmeldung, gelöscht wie bei der Abmeldung"
              status="ok"
              accent={accentOf.ok}
            />
          ),
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: Tokens.layout.contentMaxWidth,
    alignSelf: "center",
    padding: Tokens.layout.gutter,
    gap: Tokens.space.lg,
  },
});
