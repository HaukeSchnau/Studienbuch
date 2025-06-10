import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { type Result, ok, err, ResultAsync } from "neverthrow";
import { intoError } from "@stu/lib";

Notifications.setNotificationHandler({
  // eslint-disable-next-line @typescript-eslint/require-await
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getPushToken = ResultAsync.fromThrowable(
  Notifications.getExpoPushTokenAsync,
  intoError,
);

export async function registerForPushNotificationsAsync(): Promise<
  Result<
    string,
    | "PERMISSION_NOT_GRANTED"
    | "PROJECT_ID_NOT_FOUND"
    | "PHYSICAL_DEVICE_REQUIRED"
    | Error
  >
> {
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

  if (!Device.isDevice) return err("PHYSICAL_DEVICE_REQUIRED");

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    return err("PERMISSION_NOT_GRANTED");
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const projectId: string | undefined =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    return err("PROJECT_ID_NOT_FOUND");
  }
  return getPushToken({
    projectId,
  }).map((token) => token.data);
}
