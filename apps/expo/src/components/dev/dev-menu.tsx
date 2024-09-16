import { View } from "react-native";
import { Link } from "expo-router";

export const DevMenu = () => {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 32,
        right: 8,
      }}
    >
      <Link href="/_sitemap">Sitemap</Link>
    </View>
  );
};
