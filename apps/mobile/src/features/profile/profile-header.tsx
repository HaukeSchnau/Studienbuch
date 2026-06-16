import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { SystemIcon, type SystemIconName } from "~/components/ui/system-icon";
import type { Semester } from "@stu/core";
import { profileEditRoute } from "~/routing/params";
import { SemesterSelector } from "./semester-selector";

export const Header = ({
  semesters,
  selectedSemester,
  onSelectSemester,
}: {
  semesters: Semester[];
  selectedSemester: Semester;
  onSelectSemester: (semester: Semester) => void;
}) => {
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  return (
    <>
      <View className="relative h-[178px] overflow-hidden bg-primary">
        <SafeAreaView edges={["top"]}>
          <View className="relative px-8 pt-5">
            <View className="absolute top-5 right-5 z-10 opacity-70">
              <IconButton
                icon="settings"
                accessibilityLabel="Einstellungen öffnen"
                color="#FFFFFF"
                size={23}
                onPress={() => setIsSheetVisible(true)}
              />
            </View>

            <Text weight="bold" className="text-[34px] leading-[40px] text-white">
              Mein Profil
            </Text>
            <View className="h-2.5" />
            <SemesterSelector
              choices={semesters}
              selectedSemester={selectedSemester}
              onSelect={onSelectSemester}
              variant="header"
            />
          </View>
        </SafeAreaView>
        <Svg
          width="100%"
          height={36}
          viewBox="0 0 390 36"
          preserveAspectRatio="none"
          style={{ bottom: -1, left: 0, position: "absolute", right: 0 }}
        >
          <Path d="M0 25 C95 34 238 35 390 14 L390 36 L0 36 Z" fill="#F9F9F9" />
          <Path d="M0 25 C95 34 238 35 390 14" fill="none" stroke="#3B7FD9" strokeWidth={5} />
        </Svg>
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
