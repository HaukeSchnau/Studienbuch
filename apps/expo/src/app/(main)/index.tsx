import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Text } from "~/components/text";
import Background from "../../../assets/home-bg.svg";

export default function Tab() {
  return (
    <>
      <StatusBar style="light" />
      <Background
        width="100%"
        height={350}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
        }}
      />
      <SafeAreaView>
        <Text>Tab Settings</Text>
      </SafeAreaView>
    </>
  );
}
