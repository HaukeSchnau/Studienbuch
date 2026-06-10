import { PageScaffold } from "~/app-shell/navigation/page-scaffold";
import { NameAndYearScreen } from "~/features/setup";
import { profileCoursesRoute } from "~/routing/params";

export default function ProfileEditPage() {
  return (
    <PageScaffold title="Profil bearbeiten">
      <NameAndYearScreen
        heading="Profil"
        intro="Passe deinen Namen, Jahrgang und deine Klasse an."
        nextRoute={profileCoursesRoute}
      />
    </PageScaffold>
  );
}
