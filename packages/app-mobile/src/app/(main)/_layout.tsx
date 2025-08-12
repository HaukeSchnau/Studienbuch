import FontAwesome from "@expo/vector-icons/MaterialIcons";
import { colors } from "@stu/tailwind-config/native";
import * as Notifications from "expo-notifications";
import { Stack, Tabs } from "expo-router";
import { useEffect } from "react";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useSyncStatus } from "~/utils/events/ingest";
import { registerForPushNotificationsAsync } from "~/utils/notifications";

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
  const { mutate: registerNotificationToken } = api.auth.addNotificationToken.useMutation({
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
        if (token.isOk()) {
          registerNotificationToken({ notificationToken: token.value });
        } else {
          console.error("Error registering notification token:", token.error);
        }
      })
      .catch((error) => {
        console.error("Error registering notification token:", error);
      });

    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received", notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification response received", response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [registerNotificationToken]);

  useSyncStatus(); // required because the layer is lazily loaded

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
            tabBarIcon: ({ color }) => <FontAwesome size={28} name="home" color={color} />,
            tabBarLabel: ({ children, color }) => <Text style={{ color }}>{children}</Text>,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: "Meine Woche",
            tabBarIcon: ({ color }) => <FontAwesome size={28} name="calendar-today" color={color} />,
            tabBarLabel: ({ children, color }) => <Text style={{ color }}>{children}</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Mein Profil",
            tabBarIcon: ({ color }) => <FontAwesome size={28} name="person" color={color} />,
            tabBarLabel: ({ children, color }) => <Text style={{ color }}>{children}</Text>,
          }}
        />
      </Tabs>
    </>
  );
}
