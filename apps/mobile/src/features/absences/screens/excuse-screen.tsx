import { View } from "react-native";
import { ViewConfirmPageContent } from "~/components/layout/confirm-page-content";
import { PageScaffold } from "~/components/layout/page-scaffold";
import { Text } from "~/components/ui/text";
import { useMockAbsences } from "~/mock-app/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import { ExcuseParent } from "../excuse/excuse-parent";
import { ExcuseTeacher } from "../excuse/excuse-teacher";

export function ExcuseScreen({ date, courseIds }: { date: Date; courseIds: string[] }) {
  const { absences } = useMockAbsences();
  const { user } = useRequiredAuthenticatedSession();
  const absence = absences.find(
    (item) =>
      item.date.getTime() === date.getTime() && item.courseIds.join(";") === courseIds.join(";"),
  );

  if (!absence) {
    return (
      <PageScaffold title="Fehlzeit" contentClassName="p-8" useDefaultPadding={false}>
        <Text>Fehlzeit nicht gefunden.</Text>
      </PageScaffold>
    );
  }

  if (!user.isOfAge && !absence.parentSignature) {
    return <ExcuseParent absence={absence} />;
  }

  if (!absence.teacherSignature) {
    return <ExcuseTeacher absence={absence} />;
  }

  return (
    <PageScaffold title="Fehlzeit bestätigt" contentClassName="p-8" useDefaultPadding={false}>
      {!user.isOfAge && absence.parentSignature ? (
        <>
          <ViewConfirmPageContent
            signatureLabel="Unterschrift eines Erziehungsberechtigten"
            signatureSvg={absence.parentSignature}
          >
            Ich habe die Fehlzeit zur Kenntnis genommen.
          </ViewConfirmPageContent>
          <View className="h-16" />
        </>
      ) : null}
      {absence.teacherSignature ? (
        <ViewConfirmPageContent
          signatureLabel="Unterschrift der Lehrkraft"
          signatureSvg={absence.teacherSignature}
        >
          Die Entschuldigung wurde bestätigt.
        </ViewConfirmPageContent>
      ) : null}
    </PageScaffold>
  );
}
