import Icon from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps, ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableNativeFeedback } from "react-native";

interface Props {
  icon: ComponentProps<typeof Icon>["name"];
  color?: ComponentProps<typeof Icon>["color"];
  size?: ComponentProps<typeof Icon>["size"];
  onPress?: () => void;
  opacity?: number;
}

export const IconButton = forwardRef<ComponentRef<typeof TouchableNativeFeedback>, Props>(
  ({ icon, color, size, onPress, opacity = 1 }, ref) => {
    return (
      <TouchableNativeFeedback onPress={onPress} ref={ref}>
        <Icon name={icon} color={color} size={size} style={{ padding: 4, opacity }} />
      </TouchableNativeFeedback>
    );
  },
);
