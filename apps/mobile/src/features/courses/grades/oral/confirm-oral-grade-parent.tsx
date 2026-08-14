import { useRouter } from "expo-router";
import { format } from "date-fns";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { Text } from "~/components/ui/text";
import { formatGrade, subjectNameMap } from "@stu/core/compat/mobile-v0";
import { useGrades } from "~/data/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmOralGradeParent = ({ grade }: { grade: ResolvedGrade }) => {
  const router = useRouter();
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useGrades();

  return (
    <PageScaffold
      title="Mündliche Note bestätigen (Eltern)"
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        onCancel={() => router.back()}
        heading="Bitte lasse deine Eltern hier unterschreiben"
        onConfirm={() => signGrade(grade.id, "parent")}
        confirmLabel="Bestätigen"
        signatureLabel="Unterschrift eines Erziehungsberechtigten"
      >
        Ich habe zur Kenntnis genommen, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die mündliche Note{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
      </ConfirmPageContent>
    </PageScaffold>
  );
};

export const OralGradeParentConfirmationView = ({
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
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die mündliche Note{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> hat.
    </ViewConfirmPageContent>
  );
};
