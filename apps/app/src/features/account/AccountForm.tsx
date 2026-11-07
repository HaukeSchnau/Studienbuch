import { Arrive } from "@stu/ui/Arrive";
import { Icon } from "@stu/ui/Icon";
import { Link } from "@stu/ui/Link";
import { SuccessTick } from "@stu/ui/SuccessTick";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useAnnounce } from "@stu/ui/useAnnounce";
import { useFocusOnMount } from "@stu/ui/useFocusOnMount";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Link as RouteLink, type Href } from "expo-router";
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, View, type TextInput } from "react-native";

import { Account } from "./Account.ts";

// What the account screens share inside the sign-in card, after the old web's auth-shell.tsx: the
// sentence under a title, the one error box, the way to the other screen, the "oder" between two
// ways in, the passkey sentence, the reason behind a failed run and the credentials being typed.

/** The sentence under a step's title, centred in the softer ink. */
export function Lead({ children }: { readonly children: ReactNode }) {
  const { color } = Theme.useTheme();

  return (
    <Arrive delay={220}>
      <Text style={[styles.lead, { color: color.inkSoft }]}>{children}</Text>
    </Arrive>
  );
}

/**
 * The old web's good-news layout (AuthDone): a tick that draws itself over a centred title, then
 * the sentence. Its title has no swoosh, because the tick already marks it.
 */
export function Done({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const { color } = Theme.useTheme();
  const focus = useFocusOnMount();

  return (
    <Arrive duration={480} style={styles.done}>
      <SuccessTick />
      {/* The good news takes the focus, so a screen reader announces the step. */}
      <View
        ref={focus}
        accessible
        accessibilityRole="header"
        accessibilityLabel={title}
        tabIndex={-1}
        style={styles.focusable}
      >
        <Text variant="title1" style={[styles.doneTitle, { color: color.accent }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.lead, { color: color.inkSoft }]}>{children}</Text>
    </Arrive>
  );
}

/** A word in a lead that matters, such as the address a code went to, in full ink. */
export function Strong({ children }: { readonly children: string }) {
  const { color } = Theme.useTheme();

  return <Text style={[styles.strong, { color: color.ink }]}>{children}</Text>;
}

/** The fields and buttons of a step, under its title and lead. */
export function Form({ children }: { readonly children: ReactNode }) {
  return <View style={styles.form}>{children}</View>;
}

/**
 * What went wrong, as the old web's one error box per form, read out as soon as it shows (the
 * phones announce it, the web's alert role reads it). One box rather than one per field, because
 * a sign-in can't tell which of its two fields was wrong.
 */
export function ProblemBox({ children }: { readonly children: string }) {
  const { color } = Theme.useTheme();

  useAnnounce(children);

  return (
    <Arrive
      key={children}
      from="above"
      duration={320}
      style={[styles.problem, { backgroundColor: color.dangerTint }]}
    >
      <Text variant="subhead" role="alert" style={[styles.problemText, { color: color.danger }]}>
        {children}
      </Text>
    </Arrive>
  );
}

/** The error box with the sentence for an account problem, if there is one. */
export function ProblemText({ reason }: { readonly reason: Option.Option<Account.Reason> }) {
  return Option.match(reason, {
    onNone: () => null,
    onSome: (found) => <ProblemBox>{Account.sentence[found]}</ProblemBox>,
  });
}

export interface OtherWayProps {
  /** Left out where the link says it all, as "Zurück zur Anmeldung". */
  readonly question?: string;
  readonly label: string;
  readonly href: Href;
  /** Goes back to `href` when it is already on the stack, as "Anmelden" from "Konto erstellen". */
  readonly back?: boolean;
  /** Runs as the step changes, as "Abbrechen" ends the sign-up. */
  readonly onPress?: () => void;
}

/**
 * "Schon ein Konto? Anmelden" at the foot of the card. Every step has one, because every step can
 * be the wrong one to be on.
 */
export function OtherWay({ question, label, href, back = false, onPress }: OtherWayProps) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.otherWay}>
      {question === undefined ? null : (
        <Text variant="subhead" style={[styles.note, { color: color.inkSoft }]}>
          {question}
        </Text>
      )}
      <RouteLink href={href} dismissTo={back} onPress={onPress} asChild>
        <Link label={label} variant="subhead" />
      </RouteLink>
    </View>
  );
}

/** The line with "oder" between two ways in. */
export function Or() {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.or} aria-hidden>
      <View style={[styles.rule, { backgroundColor: color.hairline }]} />
      <Text variant="footnote" weight="regular" style={{ color: color.inkSoft }}>
        oder
      </Text>
      <View style={[styles.rule, { backgroundColor: color.hairline }]} />
    </View>
  );
}

/** A sentence about passkeys, with the passkey icon in its green tile. */
export function PasskeyLead({ children }: { readonly children: string }) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.passkey}>
      <View style={[styles.passkeyTile, { backgroundColor: color.accentTint }]}>
        <Icon name="passkey" color={color.accent} size={26} />
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
export function useCredentials(initialEmail = "") {
  const [email, setEmail] = useState(initialEmail);
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
  // mt-4, text-base, centred
  lead: { marginTop: Tokens.space.lg, fontSize: 16, lineHeight: 24, textAlign: "center" },
  done: { alignItems: "center" },
  // The focus moves here by script, so the browser's ring would only flash.
  focusable: { outlineStyle: "solid", outlineWidth: 0 },
  // mt-5, text-3xl
  doneTitle: {
    marginTop: 20,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
  },
  strong: { fontSize: 16, lineHeight: 24 },
  // mt-7, gap-4
  form: { marginTop: 28, gap: Tokens.space.lg },
  // rounded-2xl, px-4, py-3, text-sm
  problem: {
    borderRadius: Tokens.radius.field,
    paddingHorizontal: Tokens.space.lg,
    paddingVertical: Tokens.space.md,
  },
  problemText: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  // mt-6, centred, text-sm
  otherWay: {
    marginTop: Tokens.space.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: Tokens.space.xs,
  },
  note: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  // my-5, gap-3, text-xs
  or: {
    marginVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  passkey: { flexDirection: "row", alignItems: "center", gap: Tokens.space.md },
  passkeyTile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
});
