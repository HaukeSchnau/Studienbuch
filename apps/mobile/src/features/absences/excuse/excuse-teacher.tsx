import { useRouter } from "expo-router";
import { ConfirmPageContent } from "~/domain-ui/confirm-page-content";
import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { Text } from "~/components/ui/text";
import type { Absence } from "@stu/core/compat/mobile-v0";
import { Teacher } from "@stu/core/compat/mobile-v0";
import { useAbsences, useCourses } from "~/data/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";

export const ExcuseTeacher = ({ absence }: { absence: Absence }) => {
  const router = useRouter();
  const { signAbsence } = useAbsences();
  const { getCourse } = useCourses();
  const { user } = useRequiredAuthenticatedSession();
  const firstCourse = absence.courseIds[0] ? getCourse(absence.courseIds[0]) : undefined;
  const teacher = firstCourse?.teachers[0];

  if (!teacher) {
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

  return (
    <PageScaffold
      title="Fehlzeit entschuldigen (Lehrer)"
      contentClassName="p-8"
      useDefaultPadding={false}
    >
      <ConfirmPageContent
        onCancel={() => router.back()}
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, "teacher")}
        signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      >
        Ich, {Teacher.formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte:
      </ConfirmPageContent>
    </PageScaffold>
  );
};
