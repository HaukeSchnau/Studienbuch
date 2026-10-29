import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, View } from "react-native";

/** Where the Sync Lab would be, when it isn't: before the server answered, or on another server. */
export function LabNotice({ text }: { readonly text: string }) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.page, { backgroundColor: color.canvas }]}>
      <Text variant="title1">Sync Lab</Text>
      <Text variant="body" style={{ color: color.inkSoft }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: Tokens.space.xl, gap: Tokens.space.md },
});
