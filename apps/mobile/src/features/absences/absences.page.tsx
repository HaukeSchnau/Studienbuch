import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { PageScaffold } from "~/components/page-scaffold";
import { Text } from "~/components/text";
import { colors } from "~/theme/colors";
import { isAbsenceConfirmed } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { AddAbsence } from "./add-absence";
import { AbsenceItem } from "./absence-item";

export const AbsencesPage = () => {
  const [isAddVisible, setIsAddVisible] = useState(false);
  const { absences } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const unexcused = absences.filter((absence) => !isAbsenceConfirmed(absence, user.isOfAge));
  const excused = absences.filter((absence) => isAbsenceConfirmed(absence, user.isOfAge));

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
  items: ReturnType<typeof useMockApp>["absences"];
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
