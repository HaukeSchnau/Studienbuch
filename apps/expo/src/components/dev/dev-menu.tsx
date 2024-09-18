import { View } from "react-native";
import { Link } from "expo-router";

import { colors } from "@stu/tailwind-config/native";

export const DevMenu = () => {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 32,
        right: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.accent.DEFAULT,
      }}
    >
      <Link href="/_sitemap" style={{ color: "white" }}>
        Sitemap
      </Link>
    </View>
  );
};
