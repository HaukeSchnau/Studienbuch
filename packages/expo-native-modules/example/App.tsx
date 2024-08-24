import { View } from "react-native";

import { SelectView } from "@stu/expo-native-modules";

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
      />
    </View>
  );
}
