import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { LayoutAnimation, ScrollView, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import iconImage from "~/assets/icon.png";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { shadow } from "~/components/styles/shadow";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";

interface SetupScreenLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export function SetupScreenLayout({ children, showBackButton = false }: SetupScreenLayoutProps) {
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
      <View className="absolute inset-0 bg-primary-des" />
      <Backdrop />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {showBackButton ? (
            <View className="absolute top-4 left-4 z-10">
              <IconButton
                icon="chevron-left"
                accessibilityLabel="Zurück"
                variant="filled"
                elevated
                size={30}
                onPress={() => router.back()}
              />
            </View>
          ) : null}

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
              {children}
            </View>

            <View className="gap-4 self-center">
              <PressableSurface
                accessibilityLabel="Impressum öffnen"
                borderRadius={18}
                className="px-4 py-2"
                highlightColor="rgba(9, 138, 0, 0.10)"
                onPress={() => void openBrowserAsync("https://studienbuch.app/impressum")}
              >
                <Text className="text-center text-base text-neutral">Impressum</Text>
              </PressableSurface>
              <PressableSurface
                accessibilityLabel="Datenschutz öffnen"
                borderRadius={18}
                className="px-4 py-2"
                highlightColor="rgba(9, 138, 0, 0.10)"
                onPress={() => void openBrowserAsync("https://studienbuch.app/datenschutz")}
              >
                <Text className="text-center text-base text-neutral">Datenschutz</Text>
              </PressableSurface>
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
