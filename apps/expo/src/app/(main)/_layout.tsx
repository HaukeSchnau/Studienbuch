import { Tabs } from "expo-router";
import FontAwesome from "@expo/vector-icons/MaterialIcons";

import { colors } from "@stu/tailwind-config/native";

import { Text } from "~/components/text";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary.text }}>
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
  );
}
