import { Cookies, HttpBody, HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import { Data, Effect, pipe, Ref, Schema } from "effect";

export class LoginError extends Data.TaggedError("LoginError")<{ cause: unknown; step: "login" | "bearerToken" }> {}

export namespace UntisAuth {
  const basicLogin = Effect.fn(function* ({
    kadmosName,
    kadmosUsername,
    kadmosPassword,
    client,
  }: {
    kadmosName: string;
    kadmosUsername: string;
    kadmosPassword: string;
    client: HttpClient.HttpClient;
  }) {
    // First request to get the initial cookies
    yield* client.get("https://kadmos.webuntis.com/WebUntis/", {
      urlParams: {
        school: kadmosName,
      },
    });

    const schema = Schema.Struct({
      state: Schema.Literal("SUCCESS"),
    });
    yield* client
      .post("https://kadmos.webuntis.com/WebUntis/j_spring_security_check", {
        headers: {
          accept: "application/json",
        },
        body: HttpBody.urlParams([
          ["school", kadmosName],
          ["j_username", kadmosUsername],
          ["j_password", kadmosPassword],
          ["token", ""],
        ]),
      })
      .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)));
  });

  const getBearerToken = (client: HttpClient.HttpClient) =>
    client.get("https://kadmos.webuntis.com/WebUntis/api/token/new").pipe(Effect.flatMap((response) => response.text));

  export const login = Effect.fn(function* ({
    kadmosName,
    kadmosUsername,
    kadmosPassword,
  }: {
    kadmosName: string;
    kadmosUsername: string;
    kadmosPassword: string;
  }) {
    const cookies = yield* Ref.make(Cookies.empty);
    const client = yield* HttpClient.HttpClient.pipe(Effect.andThen(HttpClient.withCookiesRef(cookies)));

    yield* basicLogin({ kadmosName, kadmosUsername, kadmosPassword, client });

    const bearerToken = yield* getBearerToken(client);

    return pipe(client, HttpClient.mapRequest(HttpClientRequest.setHeader("Authorization", `Bearer ${bearerToken}`)));
  });

  export const provide = (credentials: { kadmosName: string; kadmosUsername: string; kadmosPassword: string }) =>
    Effect.provideServiceEffect(HttpClient.HttpClient, login(credentials));
}
