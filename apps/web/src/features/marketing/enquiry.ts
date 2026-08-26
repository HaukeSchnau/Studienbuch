import { MarketingApi } from "@stu/api";
import * as Schema from "effect/Schema";
import { WebRpc } from "#/infra/rpc/atoms.ts";

export const submitEnquiryMutation = WebRpc.mutation("Marketing.SubmitEnquiry");

/** Decodes uncontrolled browser form data into the RPC contract. */
export const decodeEnquiry = (form: FormData, startedAt: number) =>
  Schema.decodeUnknownExit(MarketingApi.EnquirySubmission)({
    schoolName: form.get("schoolName"),
    contactName: form.get("contactName"),
    email: form.get("email"),
    message: form.get("message"),
    trap: form.get("trap") ?? undefined,
    startedAt,
  });
