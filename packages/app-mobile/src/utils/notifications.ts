import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  // eslint-disable-next-line @typescript-eslint/require-await
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const handleRegistrationError = (error: string) => {
  console.error(error);
};

export async function registerForPushNotificationsAsync() {
  // seems like this event listener is required for the push token to be fetched and the promise below to be resolved
  Notifications.addPushTokenListener((token) => {
    console.log("THE PUSH TOKEN HAS BEEN ACQUIRED", token);
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
      handleRegistrationError(
        "Permission not granted to get push token for push notification!",
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const projectId: string | undefined =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError("Project ID not found");
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      return pushTokenString;
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      handleRegistrationError(`${e}`);
    }
  } else {
    handleRegistrationError("Must use physical device for push notifications");
  }
}
