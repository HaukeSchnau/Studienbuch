import FontAwesome from "@expo/vector-icons/MaterialIcons";
import { Stack, Tabs } from "expo-router";

import { colors } from "@stu/tailwind-config/native";

import { Text } from "~/components/text";
import { useEffect } from "react";
import { registerForPushNotificationsAsync } from "~/utils/notifications";
import { api } from "~/utils/api";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  // eslint-disable-next-line @typescript-eslint/require-await
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function TabLayout() {
  const { mutate: registerNotificationToken } =
    api.auth.addNotificationToken.useMutation({
      onSuccess: () => {
        console.log("Notification token registered");
      },
      onError: (error) => {
        console.error("Error registering notification token", error);
      },
    });

  useEffect(() => {
    void registerForPushNotificationsAsync()
      .then((token) => {
        console.log("Token", token);
        if (token) {
          registerNotificationToken({ notificationToken: token });
        }
      })
      .catch((error) => {
        console.error("Error registering notification token", error);
      });

    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received", notification);
      },
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response received", response);
      });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [registerNotificationToken]);

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
