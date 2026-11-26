import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

export interface ChangeNoteProps {
  /** "Vertretung", or on the lesson's sheet "Vertretung: Voss statt Brandt". */
  readonly text: string;
  /** Where the note sits and how far it is turned. */
  readonly style?: StyleProp<ViewStyle>;
}

/** The yellow note stuck on a changed lesson, with its turned-up corner (D76). */
export function ChangeNote({ text, style }: ChangeNoteProps) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.note, { backgroundColor: color.note }, style]}>
      <Text variant="footnote" weight="bold" style={{ color: color.noteInk }}>
        {text}
      </Text>
      <View style={[styles.fold, { borderTopColor: color.noteFold }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    paddingHorizontal: 9,
    paddingTop: Tokens.space.xs,
    paddingBottom: 5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 9,
    boxShadow: "0 2px 5px rgba(32, 55, 85, 0.22)",
  },
  // The note's turned-up corner: the top left half of a square in its bottom right corner.
  fold: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderRightWidth: 9,
    borderRightColor: "transparent",
  },
});
