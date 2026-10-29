import { useState, type ComponentRef, type Ref } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputFocusEvent,
  type TextInputProps,
} from "react-native";

import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface FieldProps extends Omit<TextInputProps, "style"> {
  readonly label: string;
  /** A line under the field, such as "Mindestens 10 Zeichen". */
  readonly hint?: string | undefined;
  /** "486/500" at the hint's right: how much of a limit the text uses. */
  readonly counter?: { readonly count: number; readonly limit: number } | undefined;
  /** Outlines the field and turns the hint red, for a value that can't be saved. */
  readonly invalid?: boolean;
  readonly ref?: Ref<ComponentRef<typeof TextInput>>;
}

/**
 * A labelled text field, filled from the tokens. Editing, autofill and keyboards stay native, and
 * every TextInput prop passes through. A green outline shows where the keyboard types.
 */
export function Field({ label, hint, counter, invalid = false, ref, ...input }: FieldProps) {
  const { color } = Theme.useTheme();
  const focus = useFocused(input);
  const edge = invalid ? color.danger : focus.focused ? color.accent : color.hairline;
  const hintColor = invalid ? color.danger : color.inkSoft;

  return (
    <View style={styles.field}>
      <Text variant="subhead" weight="semibold" style={{ color: color.inkSoft }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={color.inkSoft}
        selectionColor={color.accent}
        {...input}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        style={[
          styles.input,
          input.multiline === true ? styles.multiline : null,
          invalid || focus.focused ? styles.emphasised : null,
          { backgroundColor: color.canvas, borderColor: edge, color: color.ink },
        ]}
      />
      {hint === undefined && counter === undefined ? null : (
        <View style={styles.hint}>
          <Text
            variant="footnote"
            weight={invalid ? "bold" : "medium"}
            style={[styles.hintText, { color: hintColor }]}
          >
            {hint}
          </Text>
          {counter === undefined ? null : (
            <Text variant="footnote" weight="medium" style={{ color: hintColor }}>
              {`${String(counter.count)}/${String(counter.limit)}`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Whether the field has focus, for its outline. It wraps the caller's `onFocus` and `onBlur`, so
 * both still run.
 */
export function useFocused({ onFocus, onBlur }: Pick<TextInputProps, "onFocus" | "onBlur">) {
  const [focused, setFocused] = useState(false);

  return {
    focused,
    onFocus: (event: TextInputFocusEvent) => {
      setFocused(true);
      onFocus?.(event);
    },
    onBlur: (event: TextInputFocusEvent) => {
      setFocused(false);
      onBlur?.(event);
    },
  };
}

// A two-point outline would shift the text, so the padding gives back the extra point.
const padding = Tokens.space.lg;

const styles = StyleSheet.create({
  field: { gap: Tokens.space.xs },
  input: {
    // The edge shows the focus, so the browser's own ring would only cover it.
    outlineStyle: "solid",
    outlineWidth: 0,
    minHeight: Tokens.layout.minTarget + 4,
    borderRadius: Tokens.radius.field,
    borderWidth: 1,
    paddingHorizontal: padding,
    paddingVertical: Tokens.space.md,
    fontFamily: Theme.fontFamily,
    fontSize: Tokens.type.body.size,
    fontWeight: Tokens.type.body.weight,
  },
  multiline: { minHeight: 112, textAlignVertical: "top" },
  emphasised: {
    borderWidth: 2,
    paddingHorizontal: padding - 1,
    paddingVertical: Tokens.space.md - 1,
  },
  hint: { flexDirection: "row", justifyContent: "space-between", gap: Tokens.space.md },
  hintText: { flexShrink: 1 },
});
