import { useRouter } from "expo-router";
import { format } from "date-fns";
import { formatGrade, subjectNameMap, Teacher, type GradeType } from "~/compat/mobile-v0";
import { ConfirmPageContent, ViewConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { useProfile } from "~/features/profile";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import type { GradeSigner } from "./grade-atoms";
import type { ConfirmedResolvedGrade, ResolvedGrade } from "./grade";
import { useGrades } from "./use-grades";

const gradeTitleNames = {
  MASTER: "Gesamtnote",
  ORAL: "Mündliche Note",
  WRITTEN: "Schriftliche Note",
} satisfies Record<GradeType, string>;

const gradeStatementNames = {
  MASTER: "Gesamtnote",
  ORAL: "mündliche Note",
  WRITTEN: "Klausur",
} satisfies Record<GradeType, string>;

interface ConfirmationProps {
  readonly grade: ResolvedGrade;
  readonly signer: GradeSigner;
}

interface ConfirmationViewProps {
  readonly grade: ConfirmedResolvedGrade;
  readonly signer: GradeSigner;
}

export function GradeConfirmation({ grade, signer }: ConfirmationProps) {
  const router = useRouter();
  const { profile: user } = useProfile();
  const { signGrade } = useGrades();
  const teacher = grade.course.teachers[0];

  if (signer === "teacher" && teacher === undefined) {
    return <Text>Ungültige Note.</Text>;
  }

  const teacherName = teacher === undefined ? "" : Teacher.formalName(teacher);
  const isParent = signer === "parent";

  return (
    <PageScaffold
      title={`${gradeTitleNames[grade.type]} bestätigen (${isParent ? "Eltern" : "Lehrer"})`}
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        onCancel={() => router.back()}
        heading={`Bitte lasse deine ${isParent ? "Eltern" : "Lehrer"} hier unterschreiben`}
        onConfirm={() => signGrade(grade.id, signer)}
        confirmLabel="Bestätigen"
        signatureLabel={
          isParent ? "Unterschrift eines Erziehungsberechtigten" : `Unterschrift von ${teacherName}`
        }
      >
        <GradeStatement
          grade={grade}
          signer={signer}
          userName={user.name}
          teacherName={teacherName}
        />
      </ConfirmPageContent>
    </PageScaffold>
  );
}

export function GradeConfirmationView({ grade, signer }: ConfirmationViewProps) {
  const { profile: user } = useProfile();
  const teacher = grade.course.teachers[0];

  if (signer === "teacher" && teacher === undefined) {
    return <Text>Ungültige Note.</Text>;
  }

  const teacherName = teacher === undefined ? "" : Teacher.formalName(teacher);
  const signature = signer === "parent" ? grade.parentSignature : grade.teacherSignature;
  if (signature === null) {
    return null;
  }

  return (
    <ViewConfirmPageContent
      signatureLabel={
        signer === "parent"
          ? "Unterschrift eines Erziehungsberechtigten"
          : `Unterschrift von ${teacherName}`
      }
      signatureSvg={signature}
    >
      <GradeStatement
        grade={grade}
        signer={signer}
        userName={user.name}
        teacherName={teacherName}
      />
    </ViewConfirmPageContent>
  );
}

function GradeStatement({
  grade,
  signer,
  teacherName,
  userName,
}: {
  readonly grade: ResolvedGrade;
  readonly signer: GradeSigner;
  readonly teacherName: string;
  readonly userName: string;
}) {
  const subject = subjectNameMap[grade.course.subject];
  const date = format(grade.date, "dd.MM.yyyy");
  const result = formatGrade(grade.result);

  return (
    <>
      {signer === "parent"
        ? "Ich habe zur Kenntnis genommen, dass mein Kind "
        : `Ich, ${teacherName} bestätige, dass der/die Schüler:in `}
      <Text weight="bold">{userName}</Text> am <Text weight="bold">{date}</Text>{" "}
      {grade.type === "WRITTEN" ? (
        <>
          die Klausur in <Text weight="bold">{subject}</Text> mit der Note{" "}
          <Text weight="bold">{result}</Text> geschrieben hat.
        </>
      ) : (
        <>
          die {gradeStatementNames[grade.type]} <Text weight="bold">{result}</Text> in{" "}
          <Text weight="bold">{subject}</Text> hat.
        </>
      )}
    </>
  );
}
