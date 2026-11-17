import { Accounts } from "@stu/api/Accounts";
import { Link } from "@stu/ui/Link";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useAnnounceStatus } from "@stu/ui/useAnnounce";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useFocused } from "@stu/ui/Field";
import { Text } from "@stu/ui/Text";

import type { Account } from "./Account.ts";
import { ProblemText, reasonOf } from "./AccountForm.tsx";
import { TypedCode } from "./TypedCode.ts";

// The code from a mail, on "E-Mail bestätigen" and "Passwort vergessen?": its six boxes, what they
// keep of what is typed, and the way to a new code.

export interface CodeFieldProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
}

/**
 * The code from the mail in six of the old web's grey fields, the next one ringed in blue. A plain
 * text field lies under them and takes every touch through them, so typing, pasting and the
 * keyboard's one-time-code suggestion work as in any field, while the boxes cover its text.
 */
export function CodeField({ value, onChangeText }: CodeFieldProps) {
  const { color } = Theme.useTheme();
  const focus = useFocused({});
  const next = Math.min(value.length, TypedCode.codeLength - 1);

  return (
    <View>
      <TextInput
        accessibilityLabel="Code aus der E-Mail"
        value={value}
        onChangeText={onChangeText}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        keyboardType="number-pad"
        inputMode="numeric"
        caretHidden
        style={[StyleSheet.absoluteFill, styles.input]}
      />
      <View
        style={[styles.boxes, { backgroundColor: color.surface }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: TypedCode.codeLength }, (_, index) => {
          const active = focus.focused && index === next;

          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: color.fieldFill,
                  boxShadow: active ? `0 0 0 3px ${color.fieldRing}` : "none",
                },
              ]}
            >
              <Text variant="title1">{value[index] ?? ""}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The code as typed (`TypedCode.mailed`), and whether it is whole. `onEdit` runs when it changes,
 * so an answer about the old code goes; `clear` empties it for a new code.
 */
export function useCode(onEdit: () => void) {
  const [value, setValue] = useState("");

  return {
    value,
    complete: value.length === TypedCode.codeLength,
    set: (text: string) => {
      const next = TypedCode.mailed(text);

      if (next !== value) onEdit();
      setValue(next);
    },
    clear: () => setValue(""),
  };
}

/**
 * Seconds until the next code may go out: `Accounts.resendSeconds` from when the step opened and
 * from each `restart`, counted down once a second. A background tab or app pauses the count, so it
 * waits longer than the server at worst, never shorter.
 */
export function useResendWait() {
  const [seconds, setSeconds] = useState(Accounts.resendSeconds);

  useEffect(() => {
    if (seconds === 0) return;

    const tick = setTimeout(() => setSeconds((left) => Math.max(0, left - 1)), 1000);

    return () => clearTimeout(tick);
  }, [seconds]);

  return { seconds, restart: () => setSeconds(Accounts.resendSeconds) };
}

export interface ResendCodeProps {
  /** The last request for a code, as `useAtom` holds it. */
  readonly result: AsyncResult.AsyncResult<unknown, Account.Problem | { readonly _tag: string }>;
  /** Asks for a new code, and answers whether one went out. */
  readonly send: () => Promise<boolean>;
  /** Runs once a new code went out, to empty what was typed for the old one. */
  readonly onSent: () => void;
}

/**
 * "Neuen Code schicken" under the code. It waits as long as the server does between two codes and
 * counts down meanwhile. A new code replaces the last (D90), which the line under it says.
 */
export function ResendCode({ result, send, onSent }: ResendCodeProps) {
  const { color } = Theme.useTheme();
  const wait = useResendWait();
  const sent = AsyncResult.isSuccess(result);

  const status = sent
    ? "Wir haben dir einen neuen Code geschickt. Der vorige gilt nicht mehr."
    : "";

  useAnnounceStatus(sent ? status : undefined);

  return (
    <>
      <View style={styles.center}>
        <Link
          variant="subhead"
          label={wait.seconds > 0 ? `Neuer Code in ${wait.seconds} s` : "Neuen Code schicken"}
          busy={result.waiting}
          disabled={wait.seconds > 0}
          onPress={() =>
            void send().then((went) => {
              if (!went) return;

              wait.restart();
              onSent();
            })
          }
        />
        <Text
          variant="footnote"
          weight="regular"
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: color.inkSoft }]}
        >
          {status}
        </Text>
      </View>
      <ProblemText reason={reasonOf(result)} />
    </>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: "row", gap: Tokens.space.sm, pointerEvents: "none" },
  box: {
    flex: 1,
    height: 56,
    borderRadius: Tokens.radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    // The boxes show the focus, so the browser's own ring would frame all six.
    outlineStyle: "solid",
    outlineWidth: 0,
    // Below 16 points, mobile Safari zooms into the page on focus.
    fontSize: 16,
  },
  center: { alignItems: "center" },
  status: { textAlign: "center" },
});
