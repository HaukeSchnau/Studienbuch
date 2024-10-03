import { Redirect, Stack, Tabs } from "expo-router";
import FontAwesome from "@expo/vector-icons/MaterialIcons";

import { colors } from "@stu/tailwind-config/native";

import { Text } from "~/components/text";
import { useSession } from "~/utils/auth";

export default function TabLayout() {
  const authenticated = useSession();

  if (authenticated === null) {
    return <Stack.Screen options={{ headerShown: false }} />;
  }

  if (authenticated === false) {
    return <Redirect href="/setup/license-key" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: "Übersicht" }} />

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary.text,
          headerTintColor: colors.on.primary,
          headerStyle: {
            backgroundColor: colors.primary.DEFAULT,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            headerShown: false,
            title: "Übersicht",
            tabBarIcon: ({ color }) => (
              <FontAwesome size={28} name="home" color={color} />
            ),
            tabBarLabel: ({ children, color }) => (
              <Text style={{ color }}>{children}</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: "Meine Woche",
            tabBarIcon: ({ color }) => (
              <FontAwesome size={28} name="calendar-today" color={color} />
            ),
            tabBarLabel: ({ children, color }) => (
              <Text style={{ color }}>{children}</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Mein Profil",
            tabBarIcon: ({ color }) => (
              <FontAwesome size={28} name="person" color={color} />
            ),
            tabBarLabel: ({ children, color }) => (
              <Text style={{ color }}>{children}</Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
