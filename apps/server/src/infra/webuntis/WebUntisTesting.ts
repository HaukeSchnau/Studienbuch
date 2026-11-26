/**
 * A WebUntis behind webuntis-api's `HttpClient`, for tests of the live connection: it logs in
 * anyone, answers reads from a recording, and logs what it received and answered, in order. A test
 * can answer any request itself.
 */
import * as Clock from "effect/Clock";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import { ExamsSchema } from "@schnau/webuntis-api/schemas";
import { RecordedWebUntis } from "./RecordedWebUntis.ts";

export * as WebUntisTesting from "./WebUntisTesting.ts";

/** A request by what it reads, such as `timetable/entries CLASS 111`. */
export interface Request {
  readonly method: string;
  readonly name: string;
}

/** What a test answers instead of the recording. */
export interface Answer {
  readonly status: number;
  /** A stream lets a test hold the body back after the status arrived. */
  readonly body?: string | ReadableStream<Uint8Array>;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface Options {
  /** The recording answers as it was at this instant. */
  readonly asOf: DateTime.Utc;
  /** Answers a request itself, or leaves it to the recording. */
  readonly answer?: ((request: Request) => Effect.Effect<Option.Option<Answer>>) | undefined;
  /** How long a minted token lasts, an hour unless told otherwise. */
  readonly tokenMinutes?: number | undefined;
}

const view = "api/rest/view/v1/";

const json = (body: Schema.Json): Answer => ({
  status: 200,
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
});

const decodeJson = Schema.decodeUnknownOption(Schema.Json);

const notFound: Answer = { status: 404, body: "" };

const encodeExams = Schema.encodeEffect(Schema.toCodecJson(ExamsSchema));

/** A token of WebUntis's shape, expiring `minutes` from now on the caller's clock. */
const token = (minutes: number) =>
  Effect.map(Clock.currentTimeMillis, (now) =>
    [
      Base64Url.encode(JSON.stringify({ alg: "none" })),
      Base64Url.encode(JSON.stringify({ exp: Math.floor(now / 1000) + minutes * 60 })),
      "signature",
    ].join("."),
  );

export const make = Effect.fn("WebUntisTesting.make")(function* (
  recording: RecordedWebUntis.Recording,
  options: Options,
) {
  const events = yield* Ref.make<ReadonlyArray<string>>([]);
  const recorded = yield* RecordedWebUntis.make(recording, { asOf: options.asOf });

  const whole = (path: string) =>
    Option.match(
      Option.flatMap(Option.fromUndefinedOr(recording.get(path)), (read) =>
        RecordedWebUntis.pick(read, options.asOf),
      ),
      { onNone: () => notFound, onSome: ({ body }) => json(body) },
    );

  const fromRecording = (url: URL, year: number) => {
    const query = url.searchParams;
    const read = url.pathname.slice(url.pathname.indexOf(view) + view.length);
    const resourceType = query.get("resourceType") ?? "";

    switch (read) {
      case "app/data":
        return Effect.succeed(whole(RecordedWebUntis.paths.appData));
      case "schoolyears":
        return Effect.succeed(whole(RecordedWebUntis.paths.schoolYears));
      case "timegrid":
        return Effect.succeed(whole(RecordedWebUntis.paths.timeGrid));
      // webuntis-api sends exams without a school year, so the recording finds it by date.
      case "exams":
        return recorded.client.exams
          .list({ start: query.get("start") ?? "", end: query.get("end") ?? "" })
          .pipe(
            Effect.flatMap(encodeExams),
            Effect.map(json),
            Effect.orElseSucceed(() => notFound),
          );
      case "timetable/filter":
        return Effect.succeed(
          resourceType === "CLASS" ||
            resourceType === "TEACHER" ||
            resourceType === "SUBJECT" ||
            resourceType === "ROOM" ||
            resourceType === "STUDENT"
            ? whole(RecordedWebUntis.paths.filter(year, resourceType))
            : notFound,
        );
      case "timetable/entries":
        return resourceType === "CLASS"
          ? Effect.map(
              recorded.client.timetable.getEntriesForResources(
                {
                  resourceType,
                  resources: [Number(query.get("resources"))],
                  start: query.get("start") ?? "",
                  end: query.get("end") ?? "",
                },
                { raw: true },
              ),
              ([answer]) =>
                Option.match(decodeJson(answer?.raw), { onNone: () => notFound, onSome: json }),
            ).pipe(Effect.orElseSucceed(() => notFound))
          : Effect.succeed(notFound);
      default:
        return Effect.succeed(notFound);
    }
  };

  const nameOf = (url: URL) => {
    const path = url.pathname.replace(/^.*\/WebUntis\//u, "").replace(view, "");
    const query = url.searchParams;
    const resourceType = query.get("resourceType");
    const resources = query.get("resources");

    return [path, resourceType, resources].filter((part) => part !== null).join(" ");
  };

  const client = HttpClient.make((request, url) =>
    Effect.gen(function* () {
      const asked: Request = { method: request.method, name: nameOf(url) };
      const label = `${asked.method} ${asked.name}`;

      yield* Ref.update(events, (all) => [...all, `→ ${label}`]);

      const given = options.answer === undefined ? Option.none() : yield* options.answer(asked);

      const answer = Option.isSome(given)
        ? given.value
        : url.pathname.endsWith("/index.do")
          ? { status: 200, body: "" }
          : url.pathname.endsWith("/j_spring_security_check")
            ? {
                status: 302,
                headers: { location: "/WebUntis/index.do", "set-cookie": "JSESSIONID=a" },
              }
            : url.pathname.endsWith("/api/token/new")
              ? { status: 200, body: yield* token(options.tokenMinutes ?? 60) }
              : yield* fromRecording(
                  url,
                  Number(request.headers["x-webuntis-api-school-year-id"] ?? Number.NaN),
                );

      yield* Ref.update(events, (all) => [...all, `← ${answer.status} ${label}`]);

      return HttpClientResponse.fromWeb(
        request,
        new Response(answer.status === 302 ? null : (answer.body ?? ""), {
          status: answer.status,
          headers: answer.headers ?? {},
        }),
      );
    }),
  );

  return {
    layer: Layer.succeed(HttpClient.HttpClient)(client),
    /** Every request as `→ <method> <read>` when it arrived and `← <status> …` when answered. */
    events: Ref.get(events),
  };
});
