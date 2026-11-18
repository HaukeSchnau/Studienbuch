import { useAtomValue } from "@effect/atom-react";
import { Card } from "@stu/ui/Card";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { SettingsGroup, SettingsRow, type SettingsRowProps } from "../../ui/SettingsRow.tsx";
import { DeleteAccountButton } from "../account/DeleteAccountButton.tsx";
import { SignOutButton } from "../account/SignOutButton.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { keyReasonOf } from "../keys/KeysUi.tsx";
import type { NotebookKeys } from "../keys/NotebookKeys.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";
import { Profile } from "./Profile.ts";

/**
 * "Profil", D83's slim profile: who the student is, the notebook's key, the way to the diagnostics,
 * and signing out or deleting the account. Settings that have no feature yet stay out.
 */
export function ProfileScreen() {
  return Option.match(KeysState.useAccountId(), {
    onNone: () => <HeroScreen title="Profil" />,
    onSome: (accountId) => <AccountProfile accountId={accountId} />,
  });
}

function AccountProfile({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const reading = useAtomValue(OnboardingState.reading(accountId));

  // Until the notebook is read, the canvas alone, so "Profil" doesn't flash before the name.
  if (AsyncResult.isInitial(reading)) {
    return <View style={[styles.blank, { backgroundColor: color.canvas }]} />;
  }

  const facts = Profile.facts(reading);

  return (
    <HeroScreen
      title={Option.getOrElse(facts.name, () => "Profil")}
      underline={Option.isSome(facts.name)}
      subtitle={Option.getOrUndefined(Profile.placement(facts))}
      leading={<Avatar name={facts.name} />}
    >
      <FactsCard facts={facts} />
      <SettingsGroup title="Notizbuch">
        <NotebookKeyRow accountId={accountId} />
      </SettingsGroup>
      <SettingsGroup title="App">
        <SettingsRow
          icon="pulse"
          tint="violet"
          seed={2}
          title="Diagnose"
          detail="App, Server, Verschlüsselung und Speicher"
          onPress={() => router.push("/diagnose")}
        />
      </SettingsGroup>
      <View style={styles.actions}>
        <SignOutButton />
        <DeleteAccountButton />
      </View>
    </HeroScreen>
  );
}

/** The initials in a blue circle, as legacy's profile had them, or a person without a name. */
function Avatar({ name }: { readonly name: Option.Option<string> }) {
  const { subject } = Theme.useTheme();

  return (
    <View aria-hidden style={[styles.avatar, { backgroundColor: subject.blue.fill }]}>
      {Option.match(name, {
        onNone: () => <Icon name="person" color="#FFFFFF" size={30} />,
        onSome: (found) => (
          <Text variant="title2" maxFontSizeMultiplier={1} style={styles.initials}>
            {Profile.initials(found)}
          </Text>
        ),
      })}
    </View>
  );
}

/** School, Jahrgang and Klasse, each only when the device holds it. */
function FactsCard({ facts }: { readonly facts: Profile.Facts }) {
  const { color } = Theme.useTheme();

  const shown = [
    { label: "Schule", value: facts.school, wide: true },
    { label: "Jahrgang", value: Option.map(facts.gradeLevel, String), wide: false },
    { label: "Klasse", value: facts.schoolClass, wide: false },
  ].flatMap(({ label, value, wide }) =>
    Option.match(value, { onNone: () => [], onSome: (text) => [{ label, text, wide }] }),
  );

  if (shown.length === 0) return null;

  return (
    <Card style={styles.facts}>
      {shown.map(({ label, text, wide }) => (
        <View key={label} style={wide ? styles.wideFact : styles.fact}>
          <Text variant="footnote" style={{ color: color.inkSoft }}>
            {label}
          </Text>
          <Text variant="headline" weight="bold">
            {text}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** Whether the notebook opens without this device, with the way to Notizbuch-Schlüssel. */
function NotebookKeyRow({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const summary = useAtomValue(KeysState.summary(accountId));

  // Present from the first render, so a screen reader reads the result that replaces "Wird geprüft".
  return (
    <View accessibilityLiveRegion="polite">
      <SettingsRow
        icon="key"
        tint="green"
        seed={0}
        {...keyRow(summary)}
        onPress={() => router.push("/notizbuch-schluessel")}
      />
    </View>
  );
}

type KeyRow = Pick<SettingsRowProps, "title" | "detail" | "attention" | "pending">;

function keyRow(summary: AsyncResult.AsyncResult<NotebookKeys.Summary, unknown>): KeyRow {
  const title = "Notizbuch-Schlüssel";

  return AsyncResult.match(summary, {
    onInitial: () => ({ title, detail: "Wird geprüft …", pending: true }),
    onFailure: () =>
      Option.contains(keyReasonOf(summary), "locked")
        ? { title, detail: "Gesperrt", attention: true }
        : { title, detail: "Nicht geprüft" },
    onSuccess: ({ value }) =>
      value.secured
        ? { title, detail: "Abgesichert, auch ohne dieses Gerät" }
        : {
            title: "Notizbuch nicht abgesichert",
            detail: "Geht dieses Gerät verloren, sind deine Hausaufgaben weg.",
            attention: true,
          },
  });
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 14px rgba(0, 40, 0, 0.25)",
  },
  initials: { color: "#FFFFFF" },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: Tokens.space.md,
    paddingHorizontal: Tokens.layout.cardPadding,
    paddingVertical: Tokens.space.lg,
  },
  fact: { width: "50%", gap: Tokens.space.xxs },
  wideFact: { width: "100%", gap: Tokens.space.xxs },
  actions: { gap: Tokens.space.md },
});
