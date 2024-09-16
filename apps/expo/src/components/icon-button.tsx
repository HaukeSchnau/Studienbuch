import type { ComponentProps } from "react";
import { TouchableNativeFeedback } from "react-native";
import Icon from "@expo/vector-icons/MaterialIcons";

interface Props {
  icon: ComponentProps<typeof Icon>["name"];
  color?: ComponentProps<typeof Icon>["color"];
  size?: ComponentProps<typeof Icon>["size"];
  onPress: () => void;
}

export const IconButton = ({ icon, color, size, onPress }: Props) => {
  return (
    <TouchableNativeFeedback onPress={onPress}>
      <Icon name={icon} color={color} size={size} style={{ padding: 4 }} />
    </TouchableNativeFeedback>
  );
};
