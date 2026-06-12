import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { SystemIcon, type SystemIconName } from "~/components/ui/system-icon";
import { getCurrentYearNum } from "@stu/core";
import { useSchool, useSessionData } from "~/data/hooks";
import { profileEditRoute } from "~/routing/params";

const initialsForName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

const Avatar = ({ name }: { name: string }) => (
  <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-accent p-4">
    <Text className="text-[27px] leading-8 text-white" weight="bold">
      {initialsForName(name)}
    </Text>
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
      <View className="overflow-hidden rounded-b-[36px] bg-primary">
        <SafeAreaView edges={["top"]}>
          <View className="relative items-center px-6 py-5">
            <View className="absolute top-5 left-5">
              <DotField rows={7} cols={8} />
            </View>
            <View className="absolute right-6 bottom-6">
              <DotField rows={5} cols={6} />
            </View>

            <View className="absolute top-4 right-4 z-10">
              <IconButton
                icon="settings"
                accessibilityLabel="Einstellungen öffnen"
                variant="filled"
                elevated
                size={24}
                onPress={() => setIsSheetVisible(true)}
              />
            </View>

            <Avatar name={user.name} />
            <View className="h-4" />
            <Text weight="bold" className="text-[30px] leading-9 text-white">
              Mein Profil
            </Text>
            <View className="h-1" />
            <View className="items-center">
              <Text className="text-[18px] leading-6 text-white/92" weight="semi-bold">
                {user.name}
              </Text>
              <Text className="text-[16px] leading-6 text-white/78">
                {year.name} · {getCurrentYearNum(year)}. Klasse
              </Text>
              <Text className="text-[15px] leading-5 text-white/72">{user.schoolName}</Text>
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
                router.push(profileEditRoute);
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
  <PressableSurface
    accessibilityLabel={label}
    borderRadius={28}
    className="flex-row items-center px-2 py-3"
    onPress={onPress}
    pressedScale={0.985}
  >
    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-des">
      <SystemIcon name={icon} size={20} color="#098A00" />
    </View>
    <View className="w-3" />
    <Text weight="semi-bold" className="text-lg text-primary-text">
      {label}
    </Text>
  </PressableSurface>
);
