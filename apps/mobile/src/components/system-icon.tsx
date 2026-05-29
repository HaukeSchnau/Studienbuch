import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { View } from "react-native";

export type SystemIconName =
  | "add"
  | "calendar-today"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "delete"
  | "edit"
  | "home"
  | "info"
  | "person"
  | "settings"
  | "shield"
  | "swipe"
  | "verified"
  | "visibility";

const symbolMap: Record<SystemIconName, ComponentProps<typeof SymbolView>["name"]> = {
  add: { ios: "plus", android: "add", web: "add" },
  "calendar-today": { ios: "calendar", android: "calendar_today", web: "calendar_today" },
  check: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
  "chevron-left": { ios: "chevron.left", android: "chevron_left", web: "chevron_left" },
  "chevron-right": { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  delete: { ios: "trash", android: "delete", web: "delete" },
  edit: { ios: "pencil", android: "edit", web: "edit" },
  home: { ios: "house.fill", android: "home", web: "home" },
  info: { ios: "info.circle", android: "info", web: "info" },
  person: { ios: "person.fill", android: "person", web: "person" },
  settings: { ios: "gearshape.fill", android: "settings", web: "settings" },
  shield: { ios: "shield", android: "shield", web: "shield" },
  swipe: { ios: "hand.draw.fill", android: "swipe", web: "swipe" },
  verified: { ios: "checkmark.seal.fill", android: "verified", web: "verified" },
  visibility: { ios: "eye", android: "visibility", web: "visibility" },
};

interface Props {
  name: SystemIconName;
  color?: string;
  size?: number;
  opacity?: number;
}

export const SystemIcon = ({ name, color, size = 24, opacity = 1 }: Props) => {
  const tintColor = color ?? "#000000";

  return (
    <View style={{ opacity }}>
      <SymbolView
        name={symbolMap[name]}
        tintColor={tintColor}
        size={size}
        fallback={<MaterialIcons name={name} size={size} color={tintColor} />}
      />
    </View>
  );
};
