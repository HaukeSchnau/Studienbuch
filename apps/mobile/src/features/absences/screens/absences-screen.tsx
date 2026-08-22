import { Stack } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { PortaledBottomSheet } from "~/ui/layout/bottom-sheet";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";
import type { Absence } from "~/compat/mobile-v0";
import { useProfile } from "~/features/profile";
import { AddAbsence } from "../components/add-absence";
import { AbsenceItem } from "../components/absence-item";
import { getAbsencesPageModel } from "../model/absences-page-model";
import { useAbsences } from "../use-absences";

export const AbsencesScreen = () => {
  const [isAddVisible, setIsAddVisible] = useState(false);
  const { absences } = useAbsences();
  const { profile: user } = useProfile();
  const { unexcused, excused } = getAbsencesPageModel({
    absences,
    isOfAge: user.isOfAge,
  });

  return (
    <>
      {isAddVisible ? (
        <PortaledBottomSheet iosSnapPoints={["62%"]} onClose={() => setIsAddVisible(false)}>
          <AddAbsence onClose={() => setIsAddVisible(false)} />
        </PortaledBottomSheet>
      ) : null}
      <PageScaffold
        title="Meine Fehlzeiten"
        contentClassName="gap-8"
        headerRight={
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "plus" : undefined}
            accessibilityLabel="Fehlzeit eintragen"
            onPress={() => setIsAddVisible(true)}
          >
            Hinzufügen
          </Stack.Toolbar.Button>
        }
      >
        <AbsenceSection
          title="unentschuldigte Fehlzeiten"
          titleColor={colors.danger.DEFAULT}
          items={unexcused}
          emptyLabel="Keine unentschuldigten Fehlzeiten gefunden"
        />
        <AbsenceSection
          title="entschuldigte Fehlzeiten"
          titleColor={colors.primary.text}
          items={excused}
          emptyLabel="Keine entschuldigten Fehlzeiten gefunden"
        />
      </PageScaffold>
    </>
  );
};

const AbsenceSection = ({
  title,
  titleColor,
  items,
  emptyLabel,
}: {
  title: string;
  titleColor: string;
  items: Absence[];
  emptyLabel: string;
}) => (
  <View className="gap-2">
    <Text className="text-lg" style={{ color: titleColor }}>
      {title}
    </Text>
    {items.length > 0 ? (
      items.map((absence) => <AbsenceItem key={absence.id} absence={absence} />)
    ) : (
      <Text className="text-center">{emptyLabel}</Text>
    )}
  </View>
);
