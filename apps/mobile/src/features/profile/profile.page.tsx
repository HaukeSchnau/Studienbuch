import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { Card } from "~/components/card";
import { IconButton } from "~/components/icon-button";
import { useMainTabBarPadding } from "~/components/use-main-tab-bar-padding";
import { Text } from "~/components/text";
import { findCurrentSemester } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { CourseList } from "./course-list";
import { Header } from "./profile-header";
import { SemesterSelector } from "./semester-selector";

export const ProfilePage = () => {
  const { semesters } = useMockApp();
  const [selectedSemester, setSelectedSemester] = useState(findCurrentSemester(semesters)!);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const bottomPadding = useMainTabBarPadding(24);

  return (
    <View className="flex-1 overflow-hidden bg-background">
      {isSettingsVisible ? (
        <PortaledBottomSheet onClose={() => setIsSettingsVisible(false)}>
          <View className="px-6 pb-2">
            <Text weight="bold" className="text-2xl text-primary-text">
              Einstellungen
            </Text>
            <View className="h-4" />

            <ActionRow
              label="Profil & Kurse bearbeiten"
              onPress={() => {
                setIsSettingsVisible(false);
                router.push("/setup/name-and-year");
              }}
            />
            <ActionRow
              label="Impressum"
              onPress={() => {
                setIsSettingsVisible(false);
                void openBrowserAsync("https://studienbuch.app/impressum");
              }}
            />
            <ActionRow
              label="Datenschutz"
              onPress={() => {
                setIsSettingsVisible(false);
                void openBrowserAsync("https://studienbuch.app/datenschutz");
              }}
            />
          </View>
        </PortaledBottomSheet>
      ) : null}

      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        <Header />
        {semesters.length > 0 ? (
          <View className="px-5 pt-3">
            <Pressable onPress={() => setIsSettingsVisible(true)}>
              <Card radius="md" padding="sm" className="mb-3 flex-row items-center justify-between">
                <View>
                  <Text weight="semi-bold" className="text-lg text-primary-text">
                    Einstellungen
                  </Text>
                  <Text className="text-sm text-neutral">
                    Profil, Kurse und rechtliche Hinweise
                  </Text>
                </View>
                <IconButton icon="settings" variant="subtle" size={20} />
              </Card>
            </Pressable>
            <SemesterSelector
              choices={semesters}
              selectedSemester={selectedSemester}
              onSelect={setSelectedSemester}
            />
            <View className="h-3" />
            <CourseList semester={selectedSemester} />
          </View>
        ) : (
          <View className="px-5 py-6">
            <Text>Keine Semester gefunden</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const ActionRow = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable className="rounded-[28px] px-2 py-3" onPress={onPress}>
    <Text weight="semi-bold" className="text-lg text-primary-text">
      {label}
    </Text>
  </Pressable>
);
