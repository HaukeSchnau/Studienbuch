import React from "react";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { Bezier } from "~/components/Bezier";

void SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <View>
      <Bezier
        style={{
          width: "100%",
          height: 250,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      />
    </View>
  );
}
