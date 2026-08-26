import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

const shortText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(2),
  Schema.isMaxLength(120),
);

const emailAddress = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(5),
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/),
);

const messageText = Schema.String.check(Schema.isMinLength(10), Schema.isMaxLength(4000));

export const SchoolEnquiry = Schema.Struct({
  schoolName: shortText,
  contactName: shortText,
  email: emailAddress,
  message: messageText,
});
export type SchoolEnquiry = typeof SchoolEnquiry.Type;

/** The school enquiry plus two deliberately simple bot signals. */
export const EnquirySubmission = Schema.Struct({
  ...SchoolEnquiry.fields,
  startedAt: Schema.Finite,
  trap: Schema.optional(Schema.String),
});
export type EnquirySubmission = typeof EnquirySubmission.Type;

export const EnquiryAccepted = Schema.Struct({ status: Schema.Literal("accepted") });
export type EnquiryAccepted = typeof EnquiryAccepted.Type;

export const SubmitEnquiry = Rpc.make("Marketing.SubmitEnquiry", {
  payload: EnquirySubmission,
  success: EnquiryAccepted,
});

export const Rpcs = RpcGroup.make(SubmitEnquiry);
