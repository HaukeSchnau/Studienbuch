import { SCHOOL_IDS } from "@stu/lib";
import { pgEnum } from "drizzle-orm/pg-core";

export const SchoolId = pgEnum("school_id", SCHOOL_IDS);
