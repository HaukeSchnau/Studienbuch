import { useRouter } from "expo-router";
import { format } from "date-fns";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import { formatGrade, subjectNameMap } from "~/compat/mobile-v0";
import { useGrades } from "~/infra/data/hooks";
import { useProfile } from "~/features/profile";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "../grade.type";

export const ConfirmOralGradeParent = ({ grade }: { grade: ResolvedGrade }) => {
  const router = useRouter();
  const { profile: user } = useProfile();
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
  const { profile: user } = useProfile();

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
