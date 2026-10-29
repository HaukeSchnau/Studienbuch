import { useAtomMount, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountState } from "../account/AccountState.ts";
import { KeysState } from "./KeysState.ts";

/**
 * Wraps the signed-in tabs. It starts the account's engine and its notebook key, and above the tabs
 * says what keeps the account from syncing or from its notebook, with the way out: a session that
 * ended goes to "Anmelden", a locked notebook to "Notizbuch entsperren".
 */
export function AccountNotice({ children }: { readonly children: ReactNode }) {
  const account = KeysState.useAccountId();

  return Option.match(account, {
    onNone: () => children,
    onSome: (accountId) => <Notice accountId={accountId}>{children}</Notice>,
  });
}

function Notice({
  accountId,
  children,
}: {
  readonly accountId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = Theme.useTheme();
  const access = AccountState.useAccess();

  const status = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(KeysState.status(accountId))),
  );

  const held = Option.getOrUndefined(KeysState.useHeld(accountId));
  const republish = useAtomRefresh(KeysState.republish(accountId));

  useAtomMount(KeysState.republish(accountId));

  const notice =
    access === "ended"
      ? {
          text: "Deine Anmeldung ist abgelaufen. Deine Einträge bleiben auf diesem Gerät und gleichen sich wieder ab, sobald du dich anmeldest.",
          action: "Anmelden",
          go: () => router.push("/anmelden"),
        }
      : status?._tag === "Locked"
        ? {
            text: "Dein Notizbuch ist gesperrt.",
            action: "Entsperren",
            go: () => router.push("/notizbuch-entsperren"),
          }
        : held === "keys-behind"
          ? {
              text: "Dein Notizbuch hat auf einem anderen Gerät einen neuen Schlüssel bekommen. Entsperre es hier noch einmal, dann kommen deine neuen Einträge an.",
              action: "Entsperren",
              go: () => router.push("/notizbuch-entsperren"),
            }
          : held === "no-key-record"
            ? {
                text: "Deine neuen Einträge warten, bis der Server deinen Schlüssel wieder hat. Dieses Gerät schickt ihn gerade.",
                action: "Erneut senden",
                go: republish,
              }
            : undefined;

  // One tree either way, so the tabs keep their state when the notice comes or goes.
  return (
    <View style={styles.screen}>
      {notice === undefined ? null : (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.notice,
            { paddingTop: insets.top + Tokens.space.md, backgroundColor: color.warningTint },
          ]}
        >
          <Text variant="subhead" style={styles.grow}>
            {notice.text}
          </Text>
          <Link label={notice.action} onPress={notice.go} />
        </View>
      )}
      {/* The notice takes the top inset, so the screens below start right under it. */}
      <SafeAreaInsetsContext.Provider value={notice === undefined ? insets : { ...insets, top: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    paddingHorizontal: Tokens.space.lg,
    paddingBottom: Tokens.space.md,
  },
  grow: { flex: 1 },
});
