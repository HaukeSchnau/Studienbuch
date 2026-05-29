import { View } from "react-native";
import { PageScaffold } from "~/components/page-scaffold";
import { Text } from "~/components/text";
import { colors } from "~/theme/colors";
import { isAbsenceConfirmed } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { AbsenceItem } from "./absence-item";

export const AbsencesPage = () => {
  const { absences } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const unexcused = absences.filter((absence) => !isAbsenceConfirmed(absence, user.isOfAge));
  const excused = absences.filter((absence) => isAbsenceConfirmed(absence, user.isOfAge));

  return (
    <PageScaffold title="Meine Fehlzeiten" contentClassName="gap-8">
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
