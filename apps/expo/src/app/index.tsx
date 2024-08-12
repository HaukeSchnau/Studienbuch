import { Text } from "react-native";
import { Stack } from "expo-router";

import { api } from "~/utils/api";

export default function Index() {
  const years = api.years.list.useQuery({ school: 1 });

  return (
    <>
      <Stack.Screen options={{ title: "Home Page" }} />

      {years.status === "pending" ? (
        <Text>Loading...</Text>
      ) : years.status === "error" ? (
        <Text>Error: {years.error.message}</Text>
      ) : (
        years.data.map((year) => <Text key={year.id}>{year.name}</Text>)
      )}
    </>
  );
}
