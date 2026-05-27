import { format } from "date-fns";
import { Stack } from "expo-router";
import { View } from "react-native";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { formatGrade, subjectNameMap, Teacher } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmMasterGradeTeacher = ({ grade }: { grade: ResolvedGrade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useMockApp();
  const teacher = grade.course.teachers[0];

  if (!teacher) {
    return <Text>Ungueltige Note.</Text>;
  }

  return (
    <View className="p-8">
      <Stack.Screen options={{ title: "Gesamtnote bestaetigen (Lehrer)" }} />
      <ConfirmPageContent
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        onConfirm={() => signGrade(grade.id, "teacher")}
        confirmLabel="Bestaetigen"
        signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      >
        Ich, {Teacher.formalName(teacher)} bestaetige, dass der/die Schueler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
      </ConfirmPageContent>
    </View>
  );
};

export const MasterGradeTeacherConfirmationView = ({
  grade,
}: {
  grade: ConfirmedResolvedGrade;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const teacher = grade.course.teachers[0];

  if (!teacher) {
    return <Text>Ungueltige Note.</Text>;
  }

  return (
    <ViewConfirmPageContent
      signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      signatureSvg={grade.teacherSignature}
    >
      Ich, {Teacher.formalName(teacher)} bestaetige, dass der/die Schueler:in{" "}
      <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
    </ViewConfirmPageContent>
  );
};
