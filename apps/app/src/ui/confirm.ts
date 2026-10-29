import { Alert } from "react-native";

/**
 * Asks before a destructive step with the platform's own alert. `confirm.web.ts` is the browser's,
 * where React Native Web's Alert does nothing.
 */
export const confirm = (title: string, message: string, action: string) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
