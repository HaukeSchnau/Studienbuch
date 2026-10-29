import { useAtomValue } from "@effect/atom-react";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { StyleSheet, View } from "react-native";

import type { Agreement } from "./Agreement.ts";
import { Lab } from "./Lab.ts";

const gapText = (gap: Agreement.Gap) => {
  switch (gap._tag) {
    case "Offline":
      return "ist offline";
    case "Empty":
      return "hat noch nichts geholt";
    case "Waiting":
      return gap.commands === 1 ? "hat 1 Änderung" : `hat ${gap.commands} Änderungen`;
    case "Behind":
      return "ist nicht auf dem neuesten Stand";
    case "Differs":
      return "hat andere Zeilen als der Server";
  }
};

const list = (letters: ReadonlyArray<string>) =>
  letters.length <= 1
    ? (letters[0] ?? "")
    : `${letters.slice(0, -1).join(", ")} und ${letters.at(-1) ?? ""}`;

/** Green once all three devices agree with the server, else what keeps each one apart. */
export function AgreementBar() {
  const { color } = Theme.useTheme();
  const judged = useAtomValue(Lab.agreement);

  const { tone, text, aside } = Option.match(judged, {
    onNone: () => ({ tone: "wait" as const, text: "Die Geräte starten.", aside: "" }),
    onSome: (devices) => {
      const apart = devices.filter((device) => device.gaps.length > 0);

      const agreeing = devices.flatMap((device) =>
        device.gaps.length === 0 ? [device.id.toUpperCase()] : [],
      );

      return apart.length === 0
        ? {
            tone: "agreed" as const,
            text: "Einig: alle drei Geräte stimmen mit dem Server überein",
            aside: "",
          }
        : {
            tone: "apart" as const,
            text: `Noch nicht einig: ${apart
              .map((device) => `Gerät ${device.id.toUpperCase()} ${list(device.gaps.map(gapText))}`)
              .join("; ")}`,
            aside:
              agreeing.length === 0
                ? ""
                : `${list(agreeing)} ${agreeing.length === 1 ? "stimmt" : "stimmen"} mit dem Server überein`,
          };
    },
  });

  const look = {
    wait: { fill: color.actionTint, ink: color.action },
    agreed: { fill: color.accent, ink: color.onAccent },
    apart: { fill: color.warningTint, ink: color.warning },
  }[tone];

  return (
    <View accessibilityRole="summary" style={[styles.bar, { backgroundColor: look.fill }]}>
      <Text variant="headline" style={[styles.text, { color: look.ink }]}>
        {text}
      </Text>
      {aside === "" ? null : (
        <Text variant="subhead" style={{ color: look.ink }}>
          {aside}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Tokens.space.md,
    borderRadius: Tokens.radius.tile,
    paddingHorizontal: Tokens.space.xl,
    paddingVertical: Tokens.space.lg,
  },
  text: { flexShrink: 1 },
});
