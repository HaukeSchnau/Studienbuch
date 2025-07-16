import { Image } from "expo-image";
import { Slot, Stack, usePathname } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect } from "react";
import { LayoutAnimation, ScrollView, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/text";
import logoImage from "../../../assets/icon.png";

export default function SetupLayout() {
  const { height } = useAnimatedKeyboard();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: height.value,
  }));

  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to animate the layout when the pathname changes
  useEffect(() => {
    LayoutAnimation.easeInEaseOut();
  }, [pathname]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Backdrop />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <SafeAreaView
          style={{
            flex: 1,
          }}
        >
          <Animated.View
            style={[
              {
                justifyContent: "center",
                alignItems: "center",
                gap: 16 * 2,
                paddingHorizontal: 32,
                height: "100%",
                flex: 1,
              },
              animatedStyle,
            ]}
          >
            <Logo />
            <View className="w-full rounded-3xl bg-white px-6 py-8" style={shadow}>
              <Slot />
            </View>

            <LegalText />
          </Animated.View>
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const LegalText = () => {
  return (
    <View className="gap-4 self-center">
      <TouchableOpacity onPress={() => openBrowserAsync("https://studienbuch.app/impressum")}>
        <Text className="text-md text-center text-[#6A6A6A]">Impressum</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => openBrowserAsync("https://studienbuch.app/datenschutz")}>
        <Text className="text-md text-center text-[#6A6A6A]">Datenschutz</Text>
      </TouchableOpacity>
    </View>
  );
};

const Logo = () => {
  return (
    <View className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[#6EB867]" style={shadow}>
      <Image source={logoImage} style={{ width: 120, height: 120, borderRadius: 50 }} />
    </View>
  );
};

const Backdrop = () => {
  return (
    <>
      <View className="absolute -left-36 top-36 h-72 w-72 rounded-full bg-[#9DBFEC]" />
      <View className="absolute -right-28 top-96 h-56 w-56 rounded-full bg-[#92C78E]" />
      <View className="absolute -left-24 top-[600px] h-48 w-48 rounded-full bg-[#CA9093]" />
    </>
  );
};
