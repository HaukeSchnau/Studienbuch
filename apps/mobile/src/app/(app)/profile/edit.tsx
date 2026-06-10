import { Stack } from "expo-router";
import { SetupScreenLayout } from "~/app-shell/setup/setup-screen-layout";
import { NameAndYearScreen } from "~/features/setup";
import { profileCoursesRoute } from "~/routing/params";

export default function ProfileEditPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SetupScreenLayout showBackButton>
        <NameAndYearScreen
          heading="Profil"
          intro="Passe deinen Namen, Jahrgang und deine Klasse an."
          nextRoute={profileCoursesRoute}
        />
      </SetupScreenLayout>
    </>
  );
}
