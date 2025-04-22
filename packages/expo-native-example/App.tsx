import { SelectView } from "@stu/expo-native";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <Text>Hello</Text>

      <SelectView options={["Option 1", "Option 2", "Option 3"]} name={"test"}>
        <Text>Hello</Text>
      </SelectView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
