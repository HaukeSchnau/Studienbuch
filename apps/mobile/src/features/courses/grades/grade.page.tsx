import { format } from "date-fns";
import { Stack } from "expo-router";
import { View } from "react-native";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { subjectNameMap, Teacher, type GradeType } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

interface Props {
  date: Date;
  courseId: string;
  type: GradeType;
}

export const GradePage = ({ date, courseId, type }: Props) => {
  const { getCourseGrades, getCourse, signGrade } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const grade = getCourseGrades(courseId).find(
    (item) => item.type === type && item.date.getTime() === date.getTime(),
  );
  const course = getCourse(courseId);

  if (!grade || !course) {
    return (
      <View className="p-8">
        <Stack.Screen options={{ title: "Note" }} />
        <Text>Note nicht gefunden.</Text>
      </View>
    );
  }

  const teacher = course.teachers[0];
  const titleMap: Record<GradeType, string> = {
    MASTER: "Gesamtnote",
    ORAL: "Mündliche Note",
    WRITTEN: "Schriftliche Note",
  };

  if (!grade.teacherSignature) {
    return (
      <View className="p-8">
        <Stack.Screen options={{ title: `${titleMap[type]} bestätigen (Lehrer)` }} />
        <ConfirmPageContent
          heading="Bitte lasse deine Lehrkraft hier unterschreiben"
          confirmLabel="Bestätigen"
          signatureLabel={`Unterschrift von ${teacher ? Teacher.formalName(teacher) : "Lehrkraft"}`}
          onConfirm={() => signGrade(grade.id, "teacher")}
        >
          Ich, <Text weight="bold">{teacher ? Teacher.formalName(teacher) : "die Lehrkraft"}</Text>{" "}
          bestätige, dass <Text weight="bold">{user.name}</Text> am{" "}
          <Text weight="bold">{format(date, "dd.MM.yyyy")}</Text> die Note{" "}
          <Text weight="bold">{grade.result}</Text> in{" "}
          <Text weight="bold">{subjectNameMap[course.subject]}</Text> erhalten hat.
        </ConfirmPageContent>
      </View>
    );
  }

  if (!user.isOfAge && !grade.parentSignature) {
    return (
      <View className="p-8">
        <Stack.Screen options={{ title: `${titleMap[type]} bestätigen (Eltern)` }} />
        <ConfirmPageContent
          heading="Bitte lasse deine Eltern hier unterschreiben"
          confirmLabel="Bestätigen"
          signatureLabel="Unterschrift eines Erziehungsberechtigten"
          onConfirm={() => signGrade(grade.id, "parent")}
        >
          Ich habe zur Kenntnis genommen, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
          <Text weight="bold">{format(date, "dd.MM.yyyy")}</Text> die Note{" "}
          <Text weight="bold">{grade.result}</Text> in{" "}
          <Text weight="bold">{subjectNameMap[course.subject]}</Text> erhalten hat.
        </ConfirmPageContent>
      </View>
    );
  }

  return (
    <View className="p-8">
      <Stack.Screen options={{ title: titleMap[type] }} />
      <ViewConfirmPageContent
        signatureLabel={`Unterschrift von ${teacher ? Teacher.formalName(teacher) : "Lehrkraft"}`}
        signatureSvg={grade.teacherSignature}
      >
        Die {titleMap[type].toLowerCase()} wurde von der Lehrkraft bestätigt.
      </ViewConfirmPageContent>
      {!user.isOfAge && grade.parentSignature ? (
        <>
          <View className="h-16" />
          <ViewConfirmPageContent
            signatureLabel="Unterschrift eines Erziehungsberechtigten"
            signatureSvg={grade.parentSignature}
          >
            Die Kenntnisnahme wurde durch die Eltern bestätigt.
          </ViewConfirmPageContent>
        </>
      ) : null}
    </View>
  );
};
