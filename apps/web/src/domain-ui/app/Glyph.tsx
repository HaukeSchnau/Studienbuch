import { StyleSheet, View } from "react-native";

// Action icons drawn from borders, so the stand-ins need no icon font. The app uses SF Symbols and
// Material Symbols through expo-symbols instead (design-language.md, section 3).

/** A tick. `size` is the box it sits in. */
export function Check({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={[
          styles.check,
          { width: size * 0.32, height: size * 0.6, borderColor: color, marginTop: -size * 0.12 },
        ]}
      />
    </View>
  );
}

/** A white tick in a filled circle, the confirmation badge. */
export function CheckBadge({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Check color="#FFFFFF" size={size * 0.8} />
    </View>
  );
}

export function Chevron({ color }: { color: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.chevron, { borderColor: color }]} />
    </View>
  );
}

export function Plus({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.bar, { width: size * 0.9, height: 3, backgroundColor: color }]} />
      <View style={[styles.bar, { width: 3, height: size * 0.9, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", width: 24, height: 24 },
  check: {
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    transform: [{ rotate: "45deg" }],
  },
  chevron: {
    width: 9,
    height: 9,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    marginLeft: -4,
    transform: [{ rotate: "45deg" }],
  },
  bar: { position: "absolute", borderRadius: 2 },
});
