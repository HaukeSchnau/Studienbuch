import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export interface EnquiryAnnouncement {
  readonly id: string;
  readonly schoolName: string;
  readonly contactName: string;
  readonly email: string;
}

/**
 * How a stored enquiry reaches a human.
 *
 * It is a port because delivery and durability have different failure modes: the row is committed
 * first and announced second, so whatever this does — or fails to do — the enquiry still exists.
 *
 * The default implementation logs at warning level, which reaches the OTLP pipeline and therefore
 * an alerting channel that already exists. That is a real notification today rather than an SMTP
 * integration that cannot be verified without credentials.
 *
 * TODO: add an SMTP layer once mail credentials exist, and select it in `layer.server.ts` when
 * they are configured. Nothing outside this file should need to change.
 */
export class EnquiryNotifier extends Context.Service<EnquiryNotifier>()(
  "@stu/server/enquiry/enquiry-notifier/EnquiryNotifier",
  {
    make: Effect.succeed({
      announce: (enquiry: EnquiryAnnouncement) =>
        // The stored row is the authority for contact details. Operational telemetry only carries
        // the opaque id needed to find it, never names, schools, email addresses, or message text.
        Effect.logWarning("School enquiry received").pipe(
          Effect.annotateLogs({
            enquiry_id: enquiry.id,
          }),
        ),
    }),
  },
) {
  static readonly layer = Layer.effect(EnquiryNotifier, this.make);
}
