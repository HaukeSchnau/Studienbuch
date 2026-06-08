import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Platform, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type SystemIconName =
  | "add"
  | "arrow-right"
  | "camera"
  | "calendar-today"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "delete"
  | "edit"
  | "home"
  | "info"
  | "more"
  | "person"
  | "settings"
  | "shield"
  | "swipe"
  | "verified"
  | "visibility";

const symbolMap: Record<SystemIconName, ComponentProps<typeof SymbolView>["name"]> = {
  add: { ios: "plus", android: "add", web: "add" },
  "arrow-right": { ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" },
  camera: { ios: "camera.fill", android: "photo_camera", web: "photo_camera" },
  "calendar-today": { ios: "calendar", android: "calendar_today", web: "calendar_today" },
  check: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
  "chevron-left": { ios: "chevron.left", android: "chevron_left", web: "chevron_left" },
  "chevron-right": { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  delete: { ios: "trash", android: "delete", web: "delete" },
  edit: { ios: "pencil", android: "edit", web: "edit" },
  home: { ios: "house.fill", android: "home", web: "home" },
  info: { ios: "info.circle", android: "info", web: "info" },
  more: { ios: "ellipsis.circle", android: "more_vert", web: "more_vert" },
  person: { ios: "person.fill", android: "person", web: "person" },
  settings: { ios: "gearshape.fill", android: "settings", web: "settings" },
  shield: { ios: "shield", android: "shield", web: "shield" },
  swipe: { ios: "hand.draw.fill", android: "swipe", web: "swipe" },
  verified: { ios: "checkmark.seal.fill", android: "verified", web: "verified" },
  visibility: { ios: "eye", android: "visibility", web: "visibility" },
};

const materialFallbackMap: Record<SystemIconName, ComponentProps<typeof MaterialIcons>["name"]> = {
  add: "add",
  "arrow-right": "arrow-forward",
  camera: "photo-camera",
  "calendar-today": "calendar-today",
  check: "check-circle",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  delete: "delete",
  edit: "edit",
  home: "home",
  info: "info",
  more: "more-vert",
  person: "person",
  settings: "settings",
  shield: "shield",
  swipe: "swipe",
  verified: "verified",
  visibility: "visibility",
};

const androidPathMap: Partial<Record<SystemIconName, string>> = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  "arrow-right": "M12 4l1.41 1.41L8.83 10H20v2H8.83l4.58 4.59L12 20l8-8-8-8z",
  camera:
    "M20 5h-3.17l-1.84-2H9.01L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "calendar-today":
    "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z",
  check:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  "chevron-left": "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z",
  "chevron-right": "M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z",
  delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  info: "M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-11h2V7h-2v2z",
  person:
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  settings:
    "M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98L14.5 2.42A.49.49 0 0 0 14 2h-4c-.25 0-.46.18-.5.42L9.12 5.07c-.61.23-1.18.56-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.31.61.22l2.49-1c.51.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.23 1.18-.56 1.69-.98l2.49 1c.23.08.48 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.12-1.65zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z",
  shield:
    "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.11-3.28 7.78-7 8.94V12H5V6.3l7-3.11v8.8z",
  swipe:
    "M13 5.5c0-1.38-1.12-2.5-2.5-2.5S8 4.12 8 5.5V12l-1.06-1.06a2.01 2.01 0 0 0-2.83 0 2.01 2.01 0 0 0 0 2.83l4.6 4.6c.57.57 1.35.9 2.12.9H17c1.66 0 3-1.34 3-3V10c0-1.1-.9-2-2-2-.36 0-.69.1-.98.27A2 2 0 0 0 15 7c-.36 0-.69.1-.98.27A2 2 0 0 0 13 7.5V5.5z",
  verified:
    "m23 12-2.44-2.78.34-3.68-3.61-.82L15.4 1.5 12 2.96 8.6 1.5 6.71 4.72l-3.61.81.34 3.69L1 12l2.44 2.78-.34 3.69 3.61.81L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.22 3.61-.81-.34-3.68L23 12zm-12.91 4.72-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.42 7.35z",
  visibility:
    "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 .01 0z",
};

interface Props {
  name: SystemIconName;
  color?: string;
  size?: number;
  opacity?: number;
}

export const SystemIcon = ({ name, color, size = 24, opacity = 1 }: Props) => {
  const tintColor = color ?? "#000000";

  if (Platform.OS === "android") {
    const path = androidPathMap[name];

    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ opacity }}
      >
        <Svg
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          width={size}
          height={size}
          viewBox="0 0 24 24"
        >
          {name === "more" ? (
            <>
              <Circle cx={12} cy={8} r={2} fill={tintColor} />
              <Circle cx={12} cy={12} r={2} fill={tintColor} />
              <Circle cx={12} cy={16} r={2} fill={tintColor} />
            </>
          ) : path ? (
            <Path d={path} fill={tintColor} />
          ) : (
            <MaterialIcons
              accessibilityElementsHidden
              accessibilityLabel=""
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              name={materialFallbackMap[name]}
              size={size}
              color={tintColor}
            />
          )}
        </Svg>
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ opacity }}
    >
      <SymbolView
        name={symbolMap[name]}
        tintColor={tintColor}
        size={size}
        fallback={<MaterialIcons name={materialFallbackMap[name]} size={size} color={tintColor} />}
      />
    </View>
  );
};
