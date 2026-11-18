import { Card } from "@stu/ui/Card";
import { Icon, type IconName } from "@stu/ui/Icon";
import { MarkerBlob } from "@stu/ui/MarkerBlob";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

export interface SettingsGroupProps {
  /** The small heading on top, such as "Notizbuch". */
  readonly title: string;
  readonly children: ReactNode;
}

/** A card of settings rows under a small heading, as on Profil (D83). */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const { color } = Theme.useTheme();

  return (
    <Card style={styles.group}>
      <Text
        variant="footnote"
        accessibilityRole="header"
        aria-level={2}
        style={[styles.heading, { color: color.inkSoft }]}
      >
        {title}
      </Text>
      {children}
    </Card>
  );
}

export interface SettingsRowProps {
  readonly icon: IconName;
  /** The subject colour of the glyph's blob. */
  readonly tint: Tokens.SubjectSlot;
  /** Picks the blob's outline, so each row keeps its own. */
  readonly seed: number;
  readonly title: string;
  readonly detail?: string | undefined;
  /** Something works now and is at risk, such as a notebook only this device opens. */
  readonly attention?: boolean;
  /** The detail is still being read, as "Wird geprüft …". */
  readonly pending?: boolean;
  readonly onPress: () => void;
}

/** One row that opens a page: a glyph on its blob, the title with a line below, a chevron. */
export function SettingsRow({
  icon,
  tint,
  seed,
  title,
  detail,
  attention = false,
  pending = false,
  onPress,
}: SettingsRowProps) {
  const { color, subject } = Theme.useTheme();
  const ink = attention ? color.warning : color.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        attention ? { backgroundColor: color.warningTint } : null,
        pressed ? { backgroundColor: attention ? color.warningTint : color.accentTint } : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {attention ? (
        <View style={[styles.bang, { backgroundColor: color.warning }]}>
          <Icon name="alert" color={color.warningTint} size={24} />
        </View>
      ) : (
        <MarkerBlob tint={subject[tint].tint} seed={seed} size={glyph}>
          <Icon name={icon} color={subject[tint].text} size={22} />
        </MarkerBlob>
      )}
      <View style={styles.text}>
        <Text variant="headline" weight="bold" style={{ color: ink }}>
          {title}
        </Text>
        {detail === undefined ? null : (
          <Text variant="subhead" style={{ color: attention ? ink : color.inkSoft }}>
            {detail}
          </Text>
        )}
      </View>
      {pending ? (
        <ActivityIndicator color={color.inkSoft} />
      ) : (
        <Icon name="chevron" color={attention ? ink : color.inkSoft} size={22} />
      )}
    </Pressable>
  );
}

const glyph = 38;

const styles = StyleSheet.create({
  group: { paddingHorizontal: Tokens.space.sm - 2, paddingVertical: Tokens.space.sm },
  heading: {
    marginHorizontal: Tokens.space.md,
    marginTop: Tokens.space.xs + 2,
    marginBottom: Tokens.space.xxs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    minHeight: 56,
    paddingVertical: Tokens.space.sm,
    paddingHorizontal: Tokens.space.sm + 2,
    borderRadius: Tokens.radius.tile - 2,
    cursor: "pointer",
  },
  pressed: { opacity: 0.85 },
  bang: {
    width: glyph,
    height: glyph,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: Tokens.space.xxs },
});
