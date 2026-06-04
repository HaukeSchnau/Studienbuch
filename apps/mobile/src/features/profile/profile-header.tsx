import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { SystemIcon, type SystemIconName } from "~/components/ui/system-icon";
import { getCurrentYearNum } from "@stu/core";
import { useSchool, useSessionData } from "~/data/hooks";
import { setupNameAndYearRoute } from "~/routing/params";

const Avatar = () => (
  <View className="h-28 w-28 items-center justify-center rounded-full bg-accent p-6">
    <SystemIcon name="person" size={48} color="white" />
  </View>
);

const DotField = ({ rows, cols }: { rows: number; cols: number }) => (
  <View style={{ gap: 6 }}>
    {Array.from({ length: rows }, (_, row) => (
      <View key={row} className="flex-row" style={{ gap: 6 }}>
        {Array.from({ length: cols }, (_, col) => (
          <View key={col} className="h-1.5 w-1.5 rounded-full bg-white/22" />
        ))}
      </View>
    ))}
  </View>
);

export const Header = () => {
  const { user } = useSessionData();
  const { years } = useSchool();
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const year = years.find((item) => item.id === user.yearId) ?? years[0]!;

  return (
    <>
      <View className="overflow-hidden rounded-b-[40px] bg-primary">
        <SafeAreaView edges={["top"]}>
          <View className="relative items-center px-6 py-7">
            <View className="absolute top-5 left-5">
              <DotField rows={8} cols={9} />
            </View>
            <View className="absolute right-6 bottom-7">
              <DotField rows={5} cols={6} />
            </View>

            <View className="absolute top-4 right-4 z-10">
              <IconButton
                icon="settings"
                variant="filled"
                elevated
                size={24}
                onPress={() => setIsSheetVisible(true)}
              />
            </View>

            <Avatar />
            <View className="h-4" />
            <Text weight="bold" className="text-3xl text-white">
              {user.name}'s Profil
            </Text>
            <View className="h-1.5" />
            <View className="items-center">
              <Text className="text-[18px] text-white/88">
                Jahrgang {year.name} ({getCurrentYearNum(year)}. Klasse)
              </Text>
              <Text className="text-[16px] text-white/78">{user.schoolName}</Text>
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
                router.push(setupNameAndYearRoute);
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
  icon: SystemIconName;
  label: string;
  onPress: () => void;
}) => (
  <Pressable className="flex-row items-center rounded-[28px] px-2 py-3" onPress={onPress}>
    <IconButton icon={icon} size={20} variant="subtle" />
    <View className="w-3" />
    <Text weight="semi-bold" className="text-lg text-primary-text">
      {label}
    </Text>
  </Pressable>
);
