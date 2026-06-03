import { format } from "date-fns";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/components/confirm-page-content";
import { PageScaffold } from "~/components/page-scaffold";
import { Text } from "~/components/text";
import { formatGrade, subjectNameMap, Teacher } from "@stu/core";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmWrittenGradeTeacher = ({ grade }: { grade: ResolvedGrade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useMockApp();
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
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> mit der Note{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> geschrieben hat.
    </ViewConfirmPageContent>
  );
};
