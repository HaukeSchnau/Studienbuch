// Feature code gets the device's storage through a service from infra/.

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the keychain in feature code
export { getItemAsync } from "expo-secure-store";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the device database in feature code
export { openDatabaseSync } from "expo-sqlite";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: passkeys in feature code
export { Passkey } from "react-native-passkeys";
