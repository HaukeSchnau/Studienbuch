import { Image } from "expo-image";
import { Slot, Stack, usePathname } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect } from "react";
import { LayoutAnimation, ScrollView, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import iconImage from "~/assets/icon.png";
import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/ui/text";

export default function SetupLayout() {
  const { height } = useAnimatedKeyboard();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: height.value,
  }));
  const pathname = usePathname();

  useEffect(() => {
    LayoutAnimation.easeInEaseOut();
  }, [pathname]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute inset-0 bg-primary-des" />
      <Backdrop />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <Animated.View
            style={[
              {
                justifyContent: "center",
                alignItems: "center",
                gap: 32,
                paddingHorizontal: 32,
                minHeight: "100%",
                flex: 1,
              },
              animatedStyle,
            ]}
          >
            <View
              className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-primary-pale"
              style={shadow}
            >
              <Image source={iconImage} style={{ width: 120, height: 120, borderRadius: 50 }} />
            </View>

            <View className="w-full rounded-3xl bg-white px-6 py-8" style={shadow}>
              <Slot />
            </View>

            <View className="gap-4 self-center">
              <TouchableOpacity
                onPress={() => void openBrowserAsync("https://studienbuch.app/impressum")}
              >
                <Text className="text-center text-base text-neutral">Impressum</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void openBrowserAsync("https://studienbuch.app/datenschutz")}
              >
                <Text className="text-center text-base text-neutral">Datenschutz</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const Backdrop = () => (
  <>
    <View className="absolute top-36 -left-36 h-72 w-72 rounded-full bg-[#9DBFEC]" />
    <View className="absolute top-96 -right-28 h-56 w-56 rounded-full bg-[#92C78E]" />
    <View className="absolute top-[600px] -left-24 h-48 w-48 rounded-full bg-[#CA9093]" />
  </>
);
