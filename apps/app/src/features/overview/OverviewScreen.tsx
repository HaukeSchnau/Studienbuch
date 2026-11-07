import { useAtomValue } from "@effect/atom-react";
import { Card } from "@stu/ui/Card";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Link as RouteLink } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";

/**
 * "Übersicht", the first screen after the first start: "Moin, Lena!" in the hero, as in the Flutter
 * app. The homework panel (M1-WP-13) comes below the greeting; until then the way to this device's
 * diagnostics sits there.
 */
export function OverviewScreen() {
  return Option.match(KeysState.useAccountId(), {
    onNone: () => <Overview name={Option.none()} school={Option.none()} />,
    onSome: (accountId) => <AccountOverview accountId={accountId} />,
  });
}

function AccountOverview({ accountId }: { readonly accountId: string }) {
  const { color } = Theme.useTheme();
  const reading = AsyncResult.value(useAtomValue(OnboardingState.reading(accountId)));

  const snapshot = Option.flatMap(reading, (value) =>
    value._tag === "Ready" ? Option.some(value.snapshot) : Option.none(),
  );

  // Until the notebook is read, the canvas alone: a greeting without the name would flash first.
  if (Option.isNone(reading))
    return <View style={[styles.blank, { backgroundColor: color.canvas }]} />;

  return (
    <Overview
      name={Option.flatMap(snapshot, (notebook) =>
        Option.fromNullishOr(notebook.profile.displayName),
      )}
      school={Option.map(snapshot, (notebook) => notebook.schoolName)}
    />
  );
}

function Overview({
  name,
  school,
}: {
  readonly name: Option.Option<string>;
  readonly school: Option.Option<string>;
}) {
  return (
    <HeroScreen
      title={Option.match(name, { onNone: () => "Moin!", onSome: (first) => `Moin, ${first}!` })}
      subtitle={Option.getOrElse(
        Option.filter(school, (each) => each !== ""),
        () => "Schön, dass du da bist.",
      )}
    >
      {/* M1-WP-13: the homework panel goes here, first under the greeting. */}
      <DeviceCard />
    </HeroScreen>
  );
}

/** The way to "Dieses Gerät", which the overview was before the first start existed. */
function DeviceCard() {
  const { color } = Theme.useTheme();

  return (
    <Card padded title="Dieses Gerät">
      <Text style={{ color: color.inkSoft }}>
        Verbindung, Verschlüsselung und Speicher prüfen. Dort meldest du dich auch ab.
      </Text>
      <RouteLink href="/diagnose" asChild>
        <Link label="Öffnen" variant="subhead" />
      </RouteLink>
    </Card>
  );
}

const styles = StyleSheet.create({ blank: { flex: 1 } });
