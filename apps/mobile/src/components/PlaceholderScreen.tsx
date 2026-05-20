import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";

type PlaceholderScreenProps = {
  title: string;
  emptyState: string;
};

export function PlaceholderScreen({ title, emptyState }: PlaceholderScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={[styles.root, { backgroundColor: isDark ? "#000000" : "#f2f2f7" }]}
    >
      <Text style={[styles.title, { color: isDark ? "#ffffff" : "#000000" }]}>{title}</Text>
      <View style={[styles.group, { backgroundColor: isDark ? "#1c1c1e" : "#ffffff" }]}>
        <Text style={[styles.emptyState, { color: isDark ? "#8e8e93" : "#6e6e73" }]}>
          {emptyState}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 41,
    marginBottom: 24,
  },
  group: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 112,
    paddingHorizontal: 20,
  },
  emptyState: {
    fontSize: 17,
    lineHeight: 22,
  },
});
