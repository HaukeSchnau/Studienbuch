import React, { forwardRef } from "react";
import { View } from "react-native";

import type { DrawingViewRef } from "@stu/expo-native-modules";
import { DrawingView } from "@stu/expo-native-modules";

import Cross from "../.././assets/cross.svg";
import { Text } from "./text";

interface Props {
  label: string;
}

export const SignatureField = forwardRef<DrawingViewRef, Props>(
  ({ label }, ref) => {
    return (
      <View
        className="relative h-80 w-full items-center justify-center"
        style={{
          borderBottomColor: "#9E9E9E",
          borderBottomWidth: 1,
          backgroundColor: "#F5F5F5",
        }}
      >
        <DrawingView
          ref={ref}
          style={{ width: "100%", height: "100%", position: "absolute" }}
        />
        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between p-4">
          <Cross width={35} height={35} color={"rgba(0, 0, 0, 0.25)"} />
          <Text className="text-lg opacity-60">{label}</Text>
        </View>
      </View>
    );
  },
);
