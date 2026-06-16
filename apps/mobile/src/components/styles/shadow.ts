import { StyleSheet } from "react-native";

export const { shadow } = StyleSheet.create({
  shadow: {
    boxShadow: "0px 6px 16px rgba(32, 55, 85, 0.06)",
    shadowColor: "#203755",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
});
