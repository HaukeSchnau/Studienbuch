import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { PageScaffold } from "~/components/layout/page-scaffold";
import { Text } from "~/components/ui/text";
import { colors } from "~/theme/colors";
import type { Absence } from "@stu/core";
import { useMockAbsences } from "~/mock-app/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import { AddAbsence } from "../components/add-absence";
import { AbsenceItem } from "../components/absence-item";
import { getAbsencesPageModel } from "../model/absences-page-model";

export const AbsencesScreen = () => {
  const [isAddVisible, setIsAddVisible] = useState(false);
  const { absences } = useMockAbsences();
  const { user } = useRequiredAuthenticatedSession();
  const { unexcused, excused } = getAbsencesPageModel({
    absences,
    isOfAge: user.isOfAge,
  });

  return (
    <>
      {isAddVisible ? (
        <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
          <AddAbsence onClose={() => setIsAddVisible(false)} />
        </PortaledBottomSheet>
      ) : null}
      <PageScaffold
        title="Meine Fehlzeiten"
        contentClassName="gap-8"
        headerRight={
          <Stack.Toolbar.Button
            icon="plus"
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
}) => {
  return (
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
};
