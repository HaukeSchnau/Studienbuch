// oxlint-disable-next-line studienbuch/test-only-imports -- fixture: the Sync Lab ships in the app
import { TestCrypto } from "@stu/e2ee/testing";

// oxlint-disable-next-line studienbuch/test-only-imports -- fixture: the simulation seals with test crypto
import { used as simulated } from "../simulation/test-only-imports.ts";

export const used = [TestCrypto, simulated];
