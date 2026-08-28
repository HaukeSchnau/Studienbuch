import { useAtom } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";

import { externalLinks } from "#/domain-ui/brand/links.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";
import { Label } from "#/ui/label.tsx";
import { Textarea } from "#/ui/textarea.tsx";
import { decodeEnquiry, submitEnquiryMutation } from "./enquiry.ts";

type Status = "idle" | "sent" | "failed";

const fieldClass = "flex flex-col gap-2";

/**
 * The enquiry form.
 *
 * It replaces a `mailto:`, which asked a head teacher to open a mail client, face an empty compose
 * window and invent an opening line. Four fields and a button is a much smaller ask.
 *
 * Spam is handled with a hidden field and a fill-time check rather than a captcha. A captcha would
 * mean a third-party script, a consent banner and an accessibility tax, which is disproportionate
 * for a form this quiet — and the server enforces the same rules regardless of what the browser
 * sends.
 */
export const EnquiryForm = () => {
  const [submissionResult, submitEnquiry] = useAtom(submitEnquiryMutation, {
    mode: "promiseExit",
  });
  const [status, setStatus] = useState<Status>("idle");
  // Set on first render rather than on mount, so it is already in place if the visitor is fast.
  const startedAt = useRef(Date.now());
  const sending = submissionResult.waiting;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submission = decodeEnquiry(new FormData(event.currentTarget), startedAt.current);
    if (Exit.isFailure(submission)) {
      setStatus("failed");
      return;
    }

    const result = await submitEnquiry({ payload: submission.value });
    setStatus(Exit.isSuccess(result) ? "sent" : "failed");
  };

  if (status === "sent") {
    return (
      <div className="confirm-in rounded-card-lg bg-primary-des p-8">
        {/* Drawn with the same dash technique as the headline's swoosh, so the one moment of
            reassurance on this page is written in the brand's own hand. */}
        <svg
          aria-hidden
          className="confirm-tick mb-4 size-10 text-primary"
          fill="none"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 17l6.5 6.5L26 10"
            pathLength={1}
            stroke="currentColor"
            strokeDasharray={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
        </svg>
        <h3 className="text-2xl text-primary-text">Danke, das ist angekommen.</h3>
        <p className="mt-3 text-lg/relaxed text-ink-soft text-pretty">
          Wir melden uns in der Regel innerhalb von zwei Werktagen. Wenn es eilig ist, erreichen Sie
          uns direkt unter{" "}
          <a className="font-bold text-accent-sec" href={externalLinks.schoolContact}>
            info@urbs.one
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate={false}
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className={fieldClass}>
          <Label htmlFor="enquiry-school">Schule</Label>
          <Input
            autoComplete="organization"
            id="enquiry-school"
            maxLength={120}
            minLength={2}
            name="schoolName"
            placeholder="IGS Musterstadt"
            required
          />
        </div>
        <div className={fieldClass}>
          <Label htmlFor="enquiry-name">Ihr Name</Label>
          <Input
            autoComplete="name"
            id="enquiry-name"
            maxLength={120}
            minLength={2}
            name="contactName"
            placeholder="Vor- und Nachname"
            required
          />
        </div>
      </div>

      <div className={fieldClass}>
        <Label htmlFor="enquiry-email">E-Mail</Label>
        <Input
          autoComplete="email"
          id="enquiry-email"
          maxLength={254}
          name="email"
          placeholder="name@schule.de"
          required
          type="email"
        />
      </div>

      <div className={fieldClass}>
        <Label htmlFor="enquiry-message">Nachricht</Label>
        <Textarea
          id="enquiry-message"
          maxLength={4000}
          minLength={10}
          name="message"
          placeholder="Worum geht es? Wie viele Schülerinnen und Schüler hat Ihre Schule?"
          required
        />
      </div>

      {/* The honeypot. Hidden from sight and from assistive technology, and skipped by tabbing, so
          only something filling in fields blindly will touch it. */}
      <div aria-hidden className="hidden">
        <label htmlFor="enquiry-trap">Bitte leer lassen</label>
        <input autoComplete="off" id="enquiry-trap" name="trap" tabIndex={-1} type="text" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          className={status === "failed" ? "nudge" : undefined}
          disabled={sending}
          size="xl"
          type="submit"
          variant="brand"
        >
          {sending ? (
            <span className="working">Wird gesendet …</span>
          ) : (
            <>
              Anfrage senden
              <ArrowRight aria-hidden />
            </>
          )}
        </Button>
        <p className="text-sm text-ink-soft">Wir melden uns innerhalb von zwei Werktagen.</p>
      </div>

      {/*
        Announced as well as shown, because the submit button does not move focus and a message that
        merely appears below it is easy to miss while the eye is still on the button. The live region
        is always in the tree so the announcement is reliable; only the message inside it changes.
      */}
      <div aria-live="polite">
        {status === "failed" ? (
          <p className="error-in text-sm text-danger">
            Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie uns
            direkt an{" "}
            <a className="font-bold underline" href={externalLinks.schoolContact}>
              info@urbs.one
            </a>
            .
          </p>
        ) : null}
      </div>
    </form>
  );
};
