import { Pressable, View } from "react-native";

const asCheckbox = { accessibilityRole: "checkbox" } as const;

const radioRole = "radio";

const ticked = { checked: true };

export function Choices({
  on,
  kind,
  onPress,
}: {
  readonly on: boolean;
  readonly kind: "checkbox" | "radio";
  readonly onPress: () => void;
}) {
  return (
    <View accessibilityRole="radiogroup">
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a checkbox's own role */}
      <Pressable accessibilityRole="checkbox" onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a radio's role in braces */}
      <Pressable role={"radio"} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a template literal */}
      <Pressable accessibilityRole={`checkbox`} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: one branch of a conditional */}
      <Pressable role={on ? "checkbox" : "button"} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: one side of a logical expression */}
      <Pressable accessibilityRole={(on && "radio") || "button"} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a const holding the role */}
      <Pressable role={radioRole} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a spread const holding the role */}
      <Pressable {...asCheckbox} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: an inline spread object */}
      <Pressable {...{ role: "radio" }} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a variable role with its checked state */}
      <Pressable accessibilityRole={kind} aria-checked={on} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: the checked state alone */}
      <Pressable aria-checked onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: accessibilityChecked in a spread */}
      <Pressable {...{ accessibilityChecked: on }} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: a checked key in accessibilityState */}
      <Pressable accessibilityState={{ checked: on }} onPress={onPress} />
      {/* oxlint-disable-next-line studienbuch/no-raw-checkable -- fixture: accessibilityState from a const */}
      <Pressable accessibilityState={ticked} onPress={onPress} />
      <Pressable accessibilityRole="button" onPress={onPress} />
      <Pressable role={on ? "button" : "link"} onPress={onPress} />
      <Pressable accessibilityState={{ disabled: on }} onPress={onPress} />
    </View>
  );
}
