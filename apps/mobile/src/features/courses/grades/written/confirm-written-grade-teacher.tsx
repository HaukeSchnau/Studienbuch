import { useRouter } from "expo-router";
import { format } from "date-fns";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import { formatGrade, subjectNameMap, Teacher } from "~/compat/mobile-v0";
import { useGrades } from "~/infra/data/hooks";
import { useProfile } from "~/features/profile";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmWrittenGradeTeacher = ({ grade }: { grade: ResolvedGrade }) => {
  const router = useRouter();
  const { profile: user } = useProfile();
  const { signGrade } = useGrades();
  const teacher = grade.course.teachers[0];

  if (!teacher) {
    return <Text>Ungültige Note.</Text>;
  }

  return (
    <PageScaffold
      title="Schriftliche Note bestätigen (Lehrer)"
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        onCancel={() => router.back()}
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        onConfirm={() => signGrade(grade.id, "teacher")}
        confirmLabel="Bestätigen"
        signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      >
        Ich, {Teacher.formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> mit der Note{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> geschrieben hat.
      </ConfirmPageContent>
    </PageScaffold>
  );
};

export const WrittenGradeTeacherConfirmationView = ({
  grade,
}: {
  grade: ConfirmedResolvedGrade;
}) => {
  const { profile: user } = useProfile();
  const teacher = grade.course.teachers[0];

  if (!teacher) {
    return <Text>Ungültige Note.</Text>;
  }

  return (
    <ViewConfirmPageContent
      signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      signatureSvg={grade.teacherSignature}
    >
      Ich, {Teacher.formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
      <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> mit der Note{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> geschrieben hat.
    </ViewConfirmPageContent>
  );
};
