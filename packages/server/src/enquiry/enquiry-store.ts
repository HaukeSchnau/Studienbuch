import { MarketingApi } from "@stu/api";
import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Database } from "../database/client.ts";
import { EnquiryNotifier } from "./enquiry-notifier.ts";
import { schoolEnquiries } from "./schema.ts";

export const SchoolEnquiry = MarketingApi.SchoolEnquiry;
export type SchoolEnquiry = MarketingApi.SchoolEnquiry;
export const EnquirySubmission = MarketingApi.EnquirySubmission;
export type EnquirySubmission = MarketingApi.EnquirySubmission;

/**
 * Stores an enquiry, then announces it.
 *
 * The order is the whole design. Committing first means a notification channel that is misconfigured,
 * rate-limited or simply down cannot cost a school its enquiry; the announcement failing only leaves
 * `notifiedAt` null, which is exactly the marker needed to find it again later.
 */
export const record = Effect.fn("Enquiry.record")(function* (enquiry: SchoolEnquiry) {
  const database = yield* Database.Service;
  const notifier = yield* EnquiryNotifier;

  const [row] = yield* database.drizzle
    .insert(schoolEnquiries)
    .values({
      schoolName: enquiry.schoolName,
      contactName: enquiry.contactName,
      email: enquiry.email,
      message: enquiry.message,
    })
    .returning({ id: schoolEnquiries.id });

  if (row === undefined) {
    return yield* Effect.die(new Error("insert into school_enquiries returned no row"));
  }

  yield* notifier
    .announce({
      id: row.id,
      schoolName: enquiry.schoolName,
      contactName: enquiry.contactName,
      email: enquiry.email,
    })
    .pipe(
      Effect.andThen(
        database.drizzle
          .update(schoolEnquiries)
          // The database stamps it, so the value cannot drift with an application clock.
          .set({ notifiedAt: sql`now()` })
          .where(eq(schoolEnquiries.id, row.id)),
      ),
      // The enquiry is already safe. A failed announcement must not fail the request and tell the
      // school to try again, which would only duplicate the row.
      Effect.catchCause((cause) =>
        Effect.logError("School enquiry stored but not announced", cause).pipe(
          Effect.annotateLogs({ enquiry_id: row.id }),
        ),
      ),
    );

  return { id: row.id } as const;
});

export * as EnquiryStore from "./enquiry-store.ts";
