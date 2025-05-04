import {
  DateTimePicker,
  DrawingView,
  DrawingViewRef,
  Picker,
} from "@stu/expo-native";
import { StatusBar } from "expo-status-bar";
import { useRef } from "react";
import { ScrollView, StyleSheet } from "react-native";

export default function App() {
  const drawingViewRef = useRef<DrawingViewRef>(null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />

      <Picker
        options={["Option 1", "Option 2", "Option 3"]}
        selectedIndex={0}
      />

      <DateTimePicker iosVariant="compact" />

      <DrawingView
        ref={drawingViewRef}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />
    </ScrollView>
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
