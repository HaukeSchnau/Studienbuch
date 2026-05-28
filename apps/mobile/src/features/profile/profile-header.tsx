import Icon from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { Text } from "~/components/text";
import { getCurrentYearNum } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

const Avatar = () => (
  <View className="h-28 w-28 items-center justify-center rounded-full bg-accent p-6">
    <Icon name="person" size={48} color="white" />
  </View>
);

const DotField = ({ rows, cols }: { rows: number; cols: number }) => (
  <View style={{ gap: 6 }}>
    {Array.from({ length: rows }, (_, row) => (
      <View key={row} className="flex-row" style={{ gap: 6 }}>
        {Array.from({ length: cols }, (_, col) => (
          <View key={col} className="h-1.5 w-1.5 rounded-full bg-white/45" />
        ))}
      </View>
    ))}
  </View>
);

export const Header = () => {
  const { user, years } = useMockApp();
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const year = years.find((item) => item.id === user.yearId) ?? years[0]!;

  return (
    <>
      <View className="overflow-hidden rounded-b-[40px] bg-primary">
        <SafeAreaView edges={["top"]}>
          <View className="relative items-center px-6 py-10">
            <View className="absolute top-5 left-5">
              <DotField rows={8} cols={9} />
            </View>
            <View className="absolute right-6 bottom-10">
              <DotField rows={5} cols={6} />
            </View>

            <View className="absolute top-4 right-4 z-10">
              <TouchableOpacity
                className="h-11 w-11 items-center justify-center rounded-full"
                onPress={() => setIsSheetVisible(true)}
              >
                <Icon name="settings" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <Avatar />
            <View className="h-6" />
            <Text weight="bold" className="text-3xl text-white">
              {user.name}'s Profil
            </Text>
            <View className="h-2" />
            <View className="items-center">
              <Text className="text-xl text-white/90">
                Jahrgang {year.name} ({getCurrentYearNum(year)}. Klasse)
              </Text>
              <Text className="text-lg text-white/85">{user.schoolName}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {isSheetVisible ? (
        <PortaledBottomSheet onClose={() => setIsSheetVisible(false)}>
          <View className="px-6 pb-2">
            <Text weight="bold" className="text-2xl text-primary-text">
              Einstellungen
            </Text>
            <View className="h-4" />

            <ActionRow
              icon="edit"
              label="Profil & Kurse bearbeiten"
              onPress={() => {
                setIsSheetVisible(false);
                router.push("/setup/name-and-year");
              }}
            />
            <ActionRow
              icon="info"
              label="Impressum"
              onPress={() => {
                setIsSheetVisible(false);
                void openBrowserAsync("https://studienbuch.app/impressum");
              }}
            />
            <ActionRow
              icon="shield"
              label="Datenschutz"
              onPress={() => {
                setIsSheetVisible(false);
                void openBrowserAsync("https://studienbuch.app/datenschutz");
              }}
            />
          </View>
        </PortaledBottomSheet>
      ) : null}
    </>
  );
};

const ActionRow = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Icon.glyphMap;
  label: string;
  onPress: () => void;
}) => (
  <Pressable className="flex-row items-center rounded-[28px] px-2 py-3" onPress={onPress}>
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-des">
      <Icon name={icon} size={20} color="#098A00" />
    </View>
    <View className="w-3" />
    <Text weight="semi-bold" className="text-lg text-primary-text">
      {label}
    </Text>
  </Pressable>
);
