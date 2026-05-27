import { format } from "date-fns";
import { Stack } from "expo-router";
import { View } from "react-native";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { formatGrade, subjectNameMap } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmMasterGradeParent = ({ grade }: { grade: ResolvedGrade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useMockApp();

  return (
    <View className="p-8">
      <Stack.Screen options={{ title: "Gesamtnote bestaetigen (Eltern)" }} />
      <ConfirmPageContent
        heading="Bitte lasse deine Eltern hier unterschreiben"
        onConfirm={() => signGrade(grade.id, "parent")}
        confirmLabel="Bestaetigen"
        signatureLabel="Unterschrift eines Erziehungsberechtigten"
      >
        Ich habe zur Kenntnis genommen, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
      </ConfirmPageContent>
    </View>
  );
};

export const MasterGradeParentConfirmationView = ({
  grade,
}: {
  grade: ConfirmedResolvedGrade & { parentSignature: string };
}) => {
  const { user } = useRequiredAuthenticatedSession();

  return (
    <ViewConfirmPageContent
      signatureLabel="Unterschrift eines Erziehungsberechtigten"
      signatureSvg={grade.parentSignature}
    >
      Ich habe zur Kenntnis genommen, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
    </ViewConfirmPageContent>
  );
};
