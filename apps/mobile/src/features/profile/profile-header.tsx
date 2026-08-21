import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PortaledBottomSheet } from "~/ui/layout/bottom-sheet";
import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { IconButton } from "~/ui/icon-button";
import { Text } from "~/ui/text";
import { SystemIcon, type SystemIconName } from "~/ui/system-icon";
import { formatClassName, getCurrentYearNum, type Semester } from "~/compat/mobile-v0";
import { useSchool, useSessionData } from "~/infra/data/hooks";
import { profileEditRoute } from "~/infra/routing/params";
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
  const { user } = useSessionData();
  const { classes, years } = useSchool();
  const year = years.find((item) => item.id === user.yearId);
  const schoolClass = classes.find((item) => item.id === user.classId);
  const classLabel =
    year && schoolClass
      ? formatClassName(schoolClass, year)
      : year
        ? `${getCurrentYearNum(year)}. Klasse`
        : "Schule";

  return (
    <>
      <View className="relative h-[222px] overflow-hidden bg-primary">
        <Svg
          width="100%"
          height={42}
          viewBox="0 0 390 42"
          pointerEvents="none"
          preserveAspectRatio="none"
          style={{ bottom: -1, left: 0, position: "absolute", right: 0, zIndex: 0 }}
        >
          <Path d="M0 30 C95 39 238 40 390 17 L390 42 L0 42 Z" fill="#F9F9F9" />
          <Path d="M0 30 C95 39 238 40 390 17" fill="none" stroke="#3B7FD9" strokeWidth={5} />
        </Svg>

        <SafeAreaView edges={["top"]} style={{ zIndex: 1 }}>
          <View className="relative px-8 pt-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1">
                <Text weight="bold" className="text-[34px] leading-[40px] text-white">
                  Mein Profil
                </Text>
                <Text className="mt-0.5 text-[15px] leading-5 text-white/82" numberOfLines={1}>
                  {user.name} · {classLabel} · {user.schoolName}
                </Text>
              </View>
              <IconButton
                icon="settings"
                accessibilityLabel="Einstellungen öffnen"
                color="#FFFFFF"
                size={25}
                className="-mr-2 -mt-1"
                onPress={() => setIsSheetVisible(true)}
              />
            </View>

            <View className="h-3" />
            <SemesterSelector
              choices={semesters}
              selectedSemester={selectedSemester}
              onSelect={onSelectSemester}
              variant="header"
            />
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
