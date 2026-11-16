// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Expo on the server
export { scheduleNotificationAsync } from "expo-notifications";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the device client on the server
export { Outbox } from "@stu/sync/client";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the Sync Lab on the server
export { Faults } from "@stu/sync/lab";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the conformance suite on the server
export { Replay } from "@stu/sync/conformance";

export const channel = "push";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a template literal import that leaves the package
export const core = () => import(`../../../packages/core/boundaries.ts`);
