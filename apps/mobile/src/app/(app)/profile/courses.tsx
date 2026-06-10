import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { ClassAndCoursesScreen } from "~/features/setup";
import { mainProfileRoute } from "~/routing/params";

export default function ProfileCoursesPage() {
  return (
    <PageScaffold title="Kurse bearbeiten">
      <ClassAndCoursesScreen
        heading="Kurse"
        intro="Passe deine aktuellen Kurse an. Die Auswahl bestimmt, welche Stunden, Aufgaben und Auswertungen angezeigt werden."
        doneRoute={mainProfileRoute}
      />
    </PageScaffold>
  );
}
