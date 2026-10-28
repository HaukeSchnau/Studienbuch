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
