import { View } from "react-native";
import { Link, Stack } from "expo-router";

import { Button } from "~/components/button";

export default function Index() {
  return (
    <>
      <View className="h-full w-full items-center justify-center">
        <Link href="/setup/license-key" asChild>
          <Button label="Start" />
        </Link>
      </View>

      <Stack.Screen options={{ title: "Home Page" }} />
    </>
  );
}
