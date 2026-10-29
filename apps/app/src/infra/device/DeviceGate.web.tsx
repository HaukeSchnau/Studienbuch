import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { Text } from "@stu/ui/Text";
import { TabOwner } from "./TabOwner.ts";
import { VirtualDevice } from "./VirtualDevice.ts";

/**
 * Renders the app only in the tab that owns this device's database (ADR 0014). Every other tab of
 * the device waits here until someone presses "Hier verwenden". Suspends while the browser decides.
 */
export function DeviceGate({ children }: { readonly children: ReactNode }) {
  const { state, takeOver } = TabOwner.useOwnership(VirtualDevice.current);

  if (state === "owner") return children;

  return (
    <HeroScreen title="Moin!" subtitle="Studienbuch ist in einem anderen Tab geöffnet.">
      <Card style={styles.card}>
        <Text>
          {Option.match(VirtualDevice.name, {
            onNone: () =>
              "Studienbuch arbeitet immer nur in einem Tab, damit nichts durcheinandergerät.",
            onSome: (name) =>
              `Gerät ${name} arbeitet immer nur in einem Tab, damit nichts durcheinandergerät.`,
          })}
        </Text>
        <Button label="Hier verwenden" busy={state === "taking over"} onPress={takeOver} />
      </Card>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: Tokens.layout.cardPadding, gap: Tokens.space.lg, alignItems: "flex-start" },
});
