import { format } from "date-fns";
import {
  ConfirmPageContent,
  ViewConfirmPageContent,
} from "~/components/layout/confirm-page-content";
import { PageScaffold } from "~/components/layout/page-scaffold";
import { Text } from "~/components/ui/text";
import { formatGrade, subjectNameMap } from "@stu/core";
import { useMockGrades } from "~/mock-app/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmWrittenGradeParent = ({ grade }: { grade: ResolvedGrade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const { signGrade } = useMockGrades();

  return (
    <PageScaffold
      title="Schriftliche Note bestätigen (Eltern)"
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        heading="Bitte lasse deine Eltern hier unterschreiben"
        onConfirm={() => signGrade(grade.id, "parent")}
        confirmLabel="Bestätigen"
        signatureLabel="Unterschrift eines Erziehungsberechtigten"
      >
        Ich habe zur Kenntnis genommen, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
        <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> mit der Note{" "}
        <Text weight="bold">{formatGrade(grade.result)}</Text> geschrieben hat.
      </ConfirmPageContent>
    </PageScaffold>
  );
};

export const WrittenGradeParentConfirmationView = ({
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
      <Text weight="bold">{format(grade.date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
      <Text weight="bold">{subjectNameMap[grade.course.subject]}</Text> mit der Note{" "}
      <Text weight="bold">{formatGrade(grade.result)}</Text> geschrieben hat.
    </ViewConfirmPageContent>
  );
};
