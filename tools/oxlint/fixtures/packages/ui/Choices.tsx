import { Pressable, View } from "react-native";

export function Choices({ onPress }: { readonly onPress: () => void }) {
  return (
    <View accessibilityRole="radiogroup">
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a checkbox's own role */}
      <Pressable accessibilityRole="checkbox" aria-checked onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a radio's own role */}
      <Pressable role={"radio"} aria-checked={false} onPress={onPress} />
      <Pressable accessibilityRole="button" onPress={onPress} />
    </View>
  );
}
