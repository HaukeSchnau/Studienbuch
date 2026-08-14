import { useRouter } from "expo-router";
import { format } from "date-fns";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { Text } from "~/components/ui/text";
import { formatGrade, subjectNameMap, Teacher } from "@stu/core/compat/mobile-v0";
import { useGrades } from "~/data/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmMasterGradeTeacher = ({ grade }: { grade: ResolvedGrade }) => {
  const router = useRouter();
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useGrades();
  const teacher = grade.course.teachers[0];

  if (!teacher) {
    return <Text>Ungültige Note.</Text>;
  }

  return (
    <PageScaffold
      title="Gesamtnote bestätigen (Lehrer)"
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
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
      </ConfirmPageContent>
    </PageScaffold>
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
    return <Text>Ungültige Note.</Text>;
  }

  return (
    <ViewConfirmPageContent
      signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      signatureSvg={grade.teacherSignature}
    >
      Ich, {Teacher.formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
      <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
    </ViewConfirmPageContent>
  );
};
