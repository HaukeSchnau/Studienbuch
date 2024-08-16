import { Link, Stack } from "expo-router";

export default function Index() {
  return (
    <>
      <Link href="/setup/license-key">License Key</Link>
      <Stack.Screen options={{ title: "Home Page" }} />
    </>
  );
}
