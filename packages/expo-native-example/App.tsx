import { DrawingView, DrawingViewRef } from "@stu/expo-native";
import { SelectView } from "@stu/expo-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { ScrollView, StyleSheet } from "react-native";

export default function App() {
  const drawingViewRef = useRef<DrawingViewRef>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      drawingViewRef.current?.getSVG().then(console.log);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={{ width: "100%", height: 100, backgroundColor: "red" }}>
        <SelectView
          name="Select"
          options={["Option 1", "Option 2", "Option 3"]}
          onSelectItem={(event) => {
            console.log(event.nativeEvent);
            drawingViewRef.current?.getSVG().then(console.log);
          }}
          style={{ width: "100%", height: "100%", backgroundColor: "blue" }}
        >
          <Text>Select</Text>
        </SelectView>
      </View>

      <Text selectable>Select</Text>

      {/* <Picker
        options={["Option 1", "Option 2", "Option 3"]}
        selectedIndex={0}
      /> */}

      {/* <DateTimePicker iosVariant="compact" /> */}

      <DrawingView
        ref={drawingViewRef}
        style={{
          width: "100%",
          height: 200,
          backgroundColor: "green",
        }}
      />
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
