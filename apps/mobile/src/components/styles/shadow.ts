import { StyleSheet } from "react-native";

export const { shadow } = StyleSheet.create({
  shadow: {
    boxShadow: "8px 8px 24px rgba(0, 0, 0, 0.12)",
    shadowColor: "#000",
    shadowOffset: {
      width: 8,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
});
