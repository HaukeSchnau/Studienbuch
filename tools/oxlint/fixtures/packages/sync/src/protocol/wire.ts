// The root of packages/sync imports neither engine side, the Lab nor the test machinery.

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the root reaches into the client
export { outbox } from "../client/outbox.ts";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the root imports the server entry
export { Push } from "@stu/sync/server";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the root imports the Lab
export { Faults } from "@stu/sync/lab";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the root imports the test machinery
export { Postgres18 } from "@stu/sync/testing";

// oxlint-disable-next-line studienbuch/import-boundaries, studienbuch/test-only-imports -- fixture: the root reaches into the simulation
export { used } from "../simulation/test-only-imports.ts";
