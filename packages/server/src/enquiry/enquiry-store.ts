import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Database } from "../database/client.ts";
import { EnquiryNotifier } from "./enquiry-notifier.ts";
import { schoolEnquiries } from "./schema.ts";

/**
 * The field rules, shared by the stored enquiry and the wire submission so the two cannot drift.
 *
 * The upper bounds are the point: they are what stops the table being used as free storage, and
 * they live here rather than in the browser, because a form is a suggestion and an API is a
 * contract.
 */
const shortText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(2),
  Schema.isMaxLength(120),
);

/**
 * Deliberately permissive. An address is only ever proven by sending to it, and a stricter pattern
 * rejects valid addresses far more often than it catches invalid ones.
 */
const emailAddress = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(5),
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/),
);

const messageText = Schema.String.check(Schema.isMinLength(10), Schema.isMaxLength(4000));

/** What is stored. */
export const SchoolEnquiry = Schema.Struct({
  schoolName: shortText,
  contactName: shortText,
  email: emailAddress,
  message: messageText,
});
export type SchoolEnquiry = typeof SchoolEnquiry.Type;

/**
 * What the browser posts: the enquiry plus two anti-spam signals.
 *
 * `startedAt` is when the form was rendered and `trap` is a hidden field no person can see. Both
 * are decoded here rather than inspected ad hoc in the handler, so the endpoint has exactly one
 * parse step and one shape.
 */
export const EnquirySubmission = Schema.Struct({
  schoolName: shortText,
  contactName: shortText,
  email: emailAddress,
  message: messageText,
  startedAt: Schema.Finite,
  trap: Schema.optional(Schema.String),
});
export type EnquirySubmission = typeof EnquirySubmission.Type;

/**
 * Synchronous on purpose. Parsing a submission needs no services, so a malformed post or a bot
 * can be answered without ever constructing the database layer.
 */
export const decodeEnquirySubmission = Schema.decodeUnknownExit(EnquirySubmission);

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
