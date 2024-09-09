import { Redirect, Stack } from "expo-router";

import { useSession } from "~/utils/auth";

export default function Index() {
  const authenticated = useSession();

  if (authenticated === null) {
    return <Stack.Screen options={{ headerShown: false }} />;
  }

  if (authenticated === false) {
    return <Redirect href="/setup/license-key" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Home Page" }} />
    </>
  );
}
