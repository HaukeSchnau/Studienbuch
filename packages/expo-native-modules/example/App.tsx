import { useRef } from "react";
import { Button, View } from "react-native";

import type { DrawingViewRef } from "@stu/expo-native-modules";
import { DrawingView, SelectView } from "@stu/expo-native-modules";

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <SelectView
        style={{
          width: 100,
          height: 50,
          backgroundColor: "purple",
          borderRadius: 10,
        }}
        name="Hello"
        options={["World", "Universe"]}
      />
      <DrawingDemo />
    </View>
  );
}

const DrawingDemo = () => {
  const drawingViewRef = useRef<DrawingViewRef>(null);

  const saveAsSVG = async () => {
    if (drawingViewRef.current) {
      const svg = await drawingViewRef.current.getSVG();
      console.log(svg); // Log SVG content
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <DrawingView ref={drawingViewRef} style={{ height: 300 }} />
      <Button title="Save as SVG" onPress={saveAsSVG} />
    </View>
  );
};
