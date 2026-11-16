import { Button } from "@stu/ui/Button";
import { Card } from "@stu/ui/Card";
import { Icon } from "@stu/ui/Icon";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, View } from "react-native";

import { RefusalText } from "./RefusalText.ts";

export interface RefusalCardProps {
  /** What the change was, such as "Abgehakt: Vocabulary Unit 4 lernen". */
  readonly change: string;
  /** Why it was refused. Its tag picks the sentence. */
  readonly reason: { readonly _tag: string };
  /** Runs the change again from its stored arguments. */
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
}

/**
 * A change that was refused. Its effect has already left the screen, so this card keeps it, with
 * the reason, until the student tries again or lets it go (sync.md, "Refusals stay visible").
 */
export function RefusalCard({ change, reason, onRetry, onDismiss }: RefusalCardProps) {
  const { color } = Theme.useTheme();

  return (
    <Card padded role="alert" style={styles.card}>
      <View style={[styles.bar, { backgroundColor: color.danger }]} />
      <View style={styles.title}>
        <Icon name="alertCircle" color={color.danger} size={22} />
        <Text variant="headline" weight="bold" style={{ color: color.danger }}>
          {RefusalText.title}
        </Text>
      </View>
      <View style={styles.text}>
        <Text variant="callout" weight="semibold">
          {change}
        </Text>
        <Text variant="callout" style={{ color: color.inkSoft }}>
          {RefusalText.sentence(reason)}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button small kind="outline" icon="retry" label="Nochmal versuchen" onPress={onRetry} />
        <Link label="Verwerfen" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Tokens.space.md },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  title: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  text: { gap: Tokens.space.xxs },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Tokens.space.md },
});
