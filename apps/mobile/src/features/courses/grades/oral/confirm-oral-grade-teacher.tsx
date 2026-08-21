import { useRouter } from "expo-router";
import { format } from "date-fns";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import { formatGrade, subjectNameMap, Teacher } from "~/compat/mobile-v0";
import { useGrades } from "~/infra/data/hooks";
import { useRequiredAuthenticatedSession } from "~/infra/session/session";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmOralGradeTeacher = ({ grade }: { grade: ResolvedGrade }) => {
  const router = useRouter();
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useGrades();
  const teacher = grade.course.teachers[0];

  if (!teacher) {
    return <Text>Ungültige Note.</Text>;
  }

  return (
    <PageScaffold
      title="Mündliche Note bestätigen (Lehrer)"
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
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die mündliche Note{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
      </ConfirmPageContent>
    </PageScaffold>
  );
};

export const OralGradeTeacherConfirmationView = ({ grade }: { grade: ConfirmedResolvedGrade }) => {
  const { user } = useRequiredAuthenticatedSession();
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
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die mündliche Note{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
    </ViewConfirmPageContent>
  );
};
