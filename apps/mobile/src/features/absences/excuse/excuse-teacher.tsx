import { ConfirmPageContent } from "~/components/confirm-page-content";
import { PageScaffold } from "~/components/page-scaffold";
import { Text } from "~/components/text";
import type { Absence } from "@stu/core";
import { Teacher } from "@stu/core";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";

export const ExcuseTeacher = ({ absence }: { absence: Absence }) => {
  const { signAbsence, getCourse } = useMockApp();
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
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        major={absence.reason}
        confirmLabel="Entschuldigen"
        onConfirm={() => signAbsence(absence.id, "teacher")}
        signatureLabel={`Unterschrift von ${Teacher.formalName(teacher)}`}
      >
        Ich, {Teacher.formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{absence.date.toLocaleDateString("de-DE")}</Text> mit folgender
        Begruendung nicht am Unterricht teilnehmen konnte:
      </ConfirmPageContent>
    </PageScaffold>
  );
};
