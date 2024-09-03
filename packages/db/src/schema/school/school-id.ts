import { pgEnum } from "drizzle-orm/pg-core";

import { SCHOOL_IDS } from "@stu/lib";

export const SchoolId = pgEnum("school_id", SCHOOL_IDS);
