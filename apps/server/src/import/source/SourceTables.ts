/**
 * The import's server-only tables (m2-import-path.md, section 3). They never sync: what WebUntis
 * sent, what each run did, and each school's lease, pause and checkpoint.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export * as SourceTables from "./SourceTables.ts";

/**
 * One version of one read: a day of a timetable, or a read without a range as a whole. A run
 * writes a version only when its body differs from the latest one of its path and day. Bodies
 * went through the storage policy, so they hold no student's name.
 */
export const sourceVersion = pgTable(
  "source_version",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    schoolId: text("school_id").notNull(),
    /** The corpus's path, such as `2026/entries/CLASS/123`. */
    path: text("path").notNull(),
    /** Null for a read without a range. */
    day: date("day", { mode: "string" }),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull(),
    /** Hex SHA-256 of the body as PostgreSQL prints its jsonb, which sorts its keys. */
    hash: text("hash").notNull(),
    body: jsonb("body").notNull(),
  },
  (table) => [
    index("source_version_latest").on(
      table.schoolId,
      table.path,
      table.day,
      table.observedAt.desc(),
    ),
    index("source_version_observed").on(table.schoolId, table.observedAt),
  ],
);

/**
 * One run that got the lease. Its reservation counts against the school's requests of its
 * school-local date from the moment it is written, also when the run dies.
 */
export const importRun = pgTable(
  "import_run",
  {
    id: uuid("id").primaryKey(),
    schoolId: text("school_id").notNull(),
    /** The school's date when the run reserved its requests. */
    date: date("date", { mode: "string" }).notNull(),
    nightly: boolean("nightly").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    /** Null while the run is going, or when its process died. */
    outcome: text("outcome"),
    reserved: integer("reserved").notNull(),
    sent: integer("sent").notNull().default(0),
    /** Counts, paths and tags of what the run read, stored and wrote. Never a body or a name. */
    report: jsonb("report")
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** The nightly self-check's measures, or why it measured nothing: a `SelfCheck.Result`. */
    selfCheck: jsonb("self_check"),
  },
  (table) => [index("import_run_school_date").on(table.schoolId, table.date)],
);

/** One export of the store into the corpus repository, and what it pushed or why it didn't. */
export const importExport = pgTable(
  "import_export",
  {
    id: uuid("id").primaryKey(),
    schoolId: text("school_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    /** `Pushed`, the failure's tag, or null while it runs or when its process died. */
    outcome: text("outcome"),
    /** The archive's name, size, hash and counts, and the commit. Never a body or a name. */
    report: jsonb("report")
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [index("import_export_school_started").on(table.schoolId, table.startedAt)],
);

/** One school's import: who may read WebUntis now, who paused it, and what the last run left. */
export const importSchool = pgTable("import_school", {
  schoolId: text("school_id").primaryKey(),
  /** A run's lease ends here at the latest, even when its process dies. */
  leaseUntil: timestamp("lease_until", { withTimezone: true, mode: "date" }),
  /** A fresh id per claim, so only the run that took the lease clears it. */
  leaseOwner: uuid("lease_owner"),
  /** Who paused the import, such as a live test's ref. No run claims the lease while it is set. */
  pausedBy: text("paused_by"),
  pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
  /** One higher with every checkpoint, so a run built on an older one can't commit. */
  revision: integer("revision").notNull().default(0),
  /** When the snapshot of the last checkpoint was read. */
  observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }),
  /** The import's identity state after the last run, without past lessons: an `ImportResult`. */
  previous: jsonb("previous"),
  /** Lessons and closures waiting for a second snapshot: `Projection.Candidate`s. */
  pending: jsonb("pending")
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** Each student's Kurswahl per term, kept until the term ends: `SelfCheck.Kept`s. */
  kurswahl: jsonb("kurswahl")
    .notNull()
    .default(sql`'[]'::jsonb`),
});
