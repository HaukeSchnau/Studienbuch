// A helper that tests share may take the test machinery, since only tests import it.
import { Postgres18 } from "@stu/sync/testing";

export * as SchoolTesting from "./SchoolTesting.ts";

export const database = Postgres18;
