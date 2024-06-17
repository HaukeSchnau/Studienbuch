import "@bacons/text-decoder/install";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

export default function RootLayout() {
  return (
    <TRPCProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#33A42B",
          },
          headerTitleStyle: {
            color: "#FFFFFF",
          },
          contentStyle: {
            backgroundColor: "#FFFFFF",
          },
        }}
      />
      <StatusBar />
    </TRPCProvider>
  );
}
