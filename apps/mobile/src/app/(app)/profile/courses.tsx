import { Stack } from "expo-router";
import { SetupScreenLayout } from "~/features/setup/setup-screen-layout";
import { ClassAndCoursesScreen } from "~/features/setup";
import { mainProfileRoute } from "~/infra/routing/params";

export default function ProfileCoursesPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SetupScreenLayout showBackButton>
        <ClassAndCoursesScreen
          heading="Kurse"
          intro="Passe deine aktuellen Kurse an. Die Auswahl bestimmt, welche Stunden, Aufgaben und Auswertungen angezeigt werden."
          doneRoute={mainProfileRoute}
        />
      </SetupScreenLayout>
    </>
  );
}
