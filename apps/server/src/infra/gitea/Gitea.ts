/**
 * Commits new files to one Gitea repository through its contents API. The server's service runs
 * without git or ssh, so a deploy key can't push from it, and Gitea's tokens can't be limited to
 * one repository: the token belongs to a user who can write that repository alone.
 */
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

export * as Gitea from "./Gitea.ts";

export interface Repository {
  /** The server, such as `https://git.example`. */
  readonly url: string;
  readonly owner: string;
  readonly name: string;
  readonly branch: string;
}

export interface File {
  readonly path: string;
  readonly content: Uint8Array;
}

/** Gitea refused the commit, so the repository is as it was. The body could quote a file. */
export class CommitRefused extends Schema.TaggedError<
  CommitRefused,
  { readonly brand: unique symbol }
>()("Gitea.CommitRefused", { status: Schema.Int }) {}

/**
 * Gitea didn't confirm the commit: no answer, a server error or an unreadable one. It commits
 * before it answers, so the repository may hold the commit.
 */
export class CommitUnconfirmed extends Schema.TaggedError<
  CommitUnconfirmed,
  { readonly brand: unique symbol }
>()("Gitea.CommitUnconfirmed", { status: Schema.optional(Schema.Int), reason: Schema.String }) {}

export class Service extends Context.Service<
  Service,
  {
    /** One commit that creates every file; it fails, and changes nothing, if one exists already. */
    readonly commit: (input: {
      readonly message: string;
      readonly files: ReadonlyArray<File>;
    }) => Effect.Effect<{ readonly commit: string }, CommitRefused | CommitUnconfirmed>;
  }
>()("Gitea.Service") {}

const Committed = Schema.Struct({ commit: Schema.Struct({ sha: Schema.String }) });

/** How long one commit may take, the upload included. */
export const timeout = Duration.minutes(2);

export const layer = (repository: Repository, token: Redacted.Redacted) =>
  Layer.effect(Service)(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const { url, owner, name, branch } = repository;

      return Service.of({
        commit: Effect.fn("Gitea.commit")(
          function* ({ message, files }) {
            const request = HttpClientRequest.post(
              `${url}/api/v1/repos/${owner}/${name}/contents`,
            ).pipe(
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.acceptJson,
              HttpClientRequest.bodyJsonUnsafe({
                branch,
                message,
                files: files.map((file) => ({
                  operation: "create",
                  path: file.path,
                  content: Base64.encode(file.content),
                })),
              }),
            );

            const response = yield* client.execute(request);

            if (response.status >= 400 && response.status < 500) {
              return yield* new CommitRefused({ status: response.status });
            }

            if (response.status !== 201) {
              return yield* new CommitUnconfirmed({
                status: response.status,
                reason: "Gitea answered without the commit",
              });
            }

            const { commit } = yield* HttpClientResponse.schemaBodyJson(Committed)(response);

            return { commit: commit.sha };
          },
          Effect.timeoutOrElse({
            duration: timeout,
            orElse: () =>
              Effect.fail(new CommitUnconfirmed({ reason: "Gitea didn't answer in time" })),
          }),
          Effect.catchTags({
            HttpClientError: () =>
              Effect.fail(new CommitUnconfirmed({ reason: "the request failed" })),
            SchemaError: () =>
              Effect.fail(new CommitUnconfirmed({ reason: "Gitea's answer names no commit" })),
          }),
        ),
      });
    }),
  );
