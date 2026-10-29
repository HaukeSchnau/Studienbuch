import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useRef, useState, type ComponentRef } from "react";
import { Image, StyleSheet, View, type TextInput } from "react-native";

import appIcon from "../../../assets/icon.png";

import { Text } from "@stu/ui/Text";
import { Account } from "./Account.ts";
import { HeroTile, Link, PasskeyIcon } from "./SharedUi.tsx";

// What the account screens share besides the copies in SharedUi.tsx: the sentence for a problem,
// the passkey sentence, the reason behind a failed run, the way to the other screen and the
// credentials being typed.

/** What went wrong, read out as soon as it shows. */
export function ProblemText({ reason }: { readonly reason: Option.Option<Account.Reason> }) {
  const { color } = Theme.useTheme();

  return Option.match(reason, {
    onNone: () => null,
    onSome: (found) => (
      <Text
        variant="subhead"
        role="alert"
        accessibilityLiveRegion="polite"
        style={{ color: color.danger }}
      >
        {Account.sentence[found]}
      </Text>
    ),
  });
}

export interface OtherWayProps {
  readonly question: string;
  readonly label: string;
  readonly onPress: () => void;
}

/** "Noch kein Konto? Konto anlegen" under the cards. */
export function OtherWay({ question, label, onPress }: OtherWayProps) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.otherWay}>
      <Text variant="subhead" style={{ color: color.inkSoft }}>
        {question}
      </Text>
      <Link label={label} onPress={onPress} />
    </View>
  );
}

/** The app's icon in the hero's tile, on the screens before an account exists. */
export function AppTile() {
  return (
    <HeroTile>
      <Image source={appIcon} accessibilityIgnoresInvertColors style={styles.appIcon} />
    </HeroTile>
  );
}

/** A sentence about passkeys, with the passkey icon in its green tile. */
export function PasskeyLead({ children }: { readonly children: string }) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.passkey}>
      <View style={[styles.passkeyTile, { backgroundColor: color.accentTint }]}>
        <PasskeyIcon color={color.accent} size={26} />
      </View>
      <Text variant="callout" style={styles.grow}>
        {children}
      </Text>
    </View>
  );
}

/** Why the last run of an account action failed, if it did and it says. */
export const reasonOf = (
  result: AsyncResult.AsyncResult<unknown, Account.Problem | { readonly _tag: string }>,
) =>
  Option.flatMap(AsyncResult.error(result), (error) =>
    error._tag === "Account.Problem" && "reason" in error
      ? Option.some(error.reason)
      : Option.none(),
  );

/** The reason inside a failed run's exit, to decide where to go next. */
export const reasonOfExit = (
  exit: Exit.Exit<unknown, Account.Problem | { readonly _tag: string }>,
) =>
  Exit.isFailure(exit)
    ? Option.flatMap(Cause.findErrorOption(exit.cause), (error) =>
        error._tag === "Account.Problem" && "reason" in error
          ? Option.some(error.reason)
          : Option.none(),
      )
    : Option.none();

/**
 * The text of a sign-in form's fields, kept while the screen is open, and the password field, which
 * the email field's return key moves to.
 */
export function useCredentials() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordField = useRef<ComponentRef<typeof TextInput>>(null);

  return {
    email,
    setEmail,
    password,
    setPassword,
    passwordField,
    toPassword: () => passwordField.current?.focus(),
  };
}

const styles = StyleSheet.create({
  otherWay: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  passkey: { flexDirection: "row", alignItems: "center", gap: Tokens.space.md },
  passkeyTile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
  appIcon: { width: 80, height: 80 },
});
