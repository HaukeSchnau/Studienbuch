import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { ReactNode } from "react";

import "./mail.css";
import { MailClient } from "./MailClient.ts";

/**
 * What a development or preview server kept instead of sending, newest first, so whoever tests a
 * sign-up can read the code. Beta and production keep no mail, and the section stays away there.
 */
export function CapturedMail() {
  const result = useAtomValue(MailClient.captured);
  const refresh = useAtomRefresh(MailClient.captured);

  const section = (children: ReactNode) => (
    <section className="console-mail" aria-labelledby="console-mail-title">
      <header>
        <h2 id="console-mail-title">Abgefangene E-Mails</h2>
        <button type="button" onClick={refresh} disabled={result.waiting}>
          Aktualisieren
        </button>
      </header>
      {children}
    </section>
  );

  return AsyncResult.match(result, {
    onInitial: () => null,
    onFailure: ({ cause }) =>
      Option.exists(Cause.findErrorOption(cause), (error) => error._tag === "Mail.NotCaptured")
        ? null
        : section(<p className="console-mail-problem">Server nicht erreichbar</p>),
    onSuccess: ({ value }) =>
      section(
        value.length === 0 ? (
          <p className="console-mail-empty">Noch keine E-Mail.</p>
        ) : (
          <ol>
            {value.map((mail) => (
              <li key={mail.id}>
                <p className="console-mail-meta">
                  <span>{mail.to}</span>
                  <time dateTime={DateTime.formatIso(mail.sentAt)}>
                    {DateTime.format(mail.sentAt, {
                      locale: "de-DE",
                      timeZone: "Europe/Berlin",
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </time>
                </p>
                <p className="console-mail-subject">{mail.subject}</p>
                <pre>{mail.text}</pre>
              </li>
            ))}
          </ol>
        ),
      ),
  });
}
