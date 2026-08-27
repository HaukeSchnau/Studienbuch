import { useRouter } from "expo-router";
import { Teacher, type Absence } from "~/compat/mobile-v0";
import { ConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { useCourses } from "~/features/courses";
import { useProfile } from "~/features/profile";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import type { AbsenceSigner } from "../absence-atoms";
import { useAbsences } from "../use-absences";

interface Props {
  readonly absence: Absence;
  readonly signer: AbsenceSigner;
}

export function AbsenceConfirmation({ absence, signer }: Props) {
  const router = useRouter();
  const { signAbsence } = useAbsences();
  const { getCourse } = useCourses();
  const { profile: user } = useProfile();
  const isParent = signer === "parent";
  const firstCourse = absence.courseIds[0] ? getCourse(absence.courseIds[0]) : undefined;
  const teacher = !isParent ? firstCourse?.teachers[0] : undefined;

  if (!isParent && teacher === undefined) {
    return (
      <PageScaffold
        title="Fehlzeit entschuldigen (Lehrer)"
        contentClassName="p-8"
        useDefaultPadding={false}
      >
        <Text>Ungültige Fehlzeit.</Text>
      </PageScaffold>
    );
  }

  const teacherName = teacher === undefined ? "" : Teacher.formalName(teacher);

  return (
    <PageScaffold
      title={`Fehlzeit entschuldigen (${isParent ? "Eltern" : "Lehrer"})`}
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        onCancel={() => router.back()}
        heading={`Bitte lasse deine ${isParent ? "Eltern" : "Lehrer"} hier unterschreiben`}
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, signer)}
        signatureLabel={
          isParent ? "Unterschrift des Erziehungsberechtigten" : `Unterschrift von ${teacherName}`
        }
      >
        {isParent ? (
          <>
            Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
            <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
            Begründung nicht am Unterricht teilnehmen konnte.
          </>
        ) : (
          <>
            Ich, {teacherName} bestätige, dass der/die Schüler:in{" "}
            <Text weight="bold">{user.name}</Text> am{" "}
            <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
            Begründung nicht am Unterricht teilnehmen konnte:
          </>
        )}
      </ConfirmPageContent>
    </PageScaffold>
  );
}
