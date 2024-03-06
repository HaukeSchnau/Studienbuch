import type { ReactNode } from "react";
import { View } from "react-native";

import { colors } from "@schnau/tailwind-config/base";

interface Props {
  children: ReactNode;
}

export const Card = ({ children }: Props) => (
  <View
    style={[
      {
        backgroundColor: colors.white,
        borderRadius: 36,
        padding: 24,
      },
      {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.16,
        shadowRadius: 4,
        elevation: 4,
      },
    ]}
  >
    {children}
  </View>
);
