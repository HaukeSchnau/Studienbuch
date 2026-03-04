import { Cookies, HttpBody, HttpClient, HttpClientRequest, HttpClientResponse, UrlParams } from "effect/unstable/http";
import { Data, Effect, pipe, Ref, Schema } from "effect";
import { withUntisHttpResilience } from "./http";
import { untisLegacyBaseUrl, untisSchoolBaseUrl, untisSchoolSearchUrl } from "./urls";

const SchoolSchema = Schema.Struct({
  displayName: Schema.String,
  loginName: Schema.String,
  server: Schema.String,
  serverUrl: Schema.String,
});
type School = typeof SchoolSchema.Type;

const SchoolSearchResponseSchema = Schema.Struct({
  result: Schema.Struct({
    schools: Schema.Array(SchoolSchema),
  }),
});

const normalizeSchoolLookup = (value: string) => value.trim().toLowerCase();

const schoolAliases = (school: School): ReadonlySet<string> =>
  new Set([
    normalizeSchoolLookup(school.displayName),
    normalizeSchoolLookup(school.loginName),
    normalizeSchoolLookup(school.server),
    normalizeSchoolLookup(school.serverUrl),
    normalizeSchoolLookup(`https://${school.server}`),
    normalizeSchoolLookup(`https://${school.server}/WebUntis/?school=${school.loginName}`),
  ]);

const queryAliases = (kadmosName: string): ReadonlySet<string> => {
  const aliases = new Set([normalizeSchoolLookup(kadmosName)]);

  try {
    const parsedUrl = new URL(kadmosName);
    aliases.add(normalizeSchoolLookup(parsedUrl.hostname));
    aliases.add(normalizeSchoolLookup(parsedUrl.href));

    const school = parsedUrl.searchParams.get("school");
    if (school) aliases.add(normalizeSchoolLookup(school));
  } catch {
    // Non-URL values are expected for most callers.
  }

  return aliases;
};

const schoolBaseUrl = (school: School) => untisSchoolBaseUrl(school.server);

export class LoginError extends Data.TaggedError("LoginError")<{
  cause: unknown;
  step: "schoolLookup" | "login" | "bearerToken";
}> {}

export class SchoolNotFoundError extends Data.TaggedError("SchoolNotFoundError")<{ kadmosName: string }> {}

export namespace UntisAuth {
  export type SchoolLookup = School;

  export const selectSchool = ({
    kadmosName,
    schools,
  }: {
    kadmosName: string;
    schools: ReadonlyArray<SchoolLookup>;
  }) => {
    const aliases = queryAliases(kadmosName);

    return schools.find((school) => {
      const schoolLookupValues = schoolAliases(school);
      for (const alias of aliases) {
        if (schoolLookupValues.has(alias)) return true;
      }
      return false;
    });
  };

  const resolveSchool = Effect.fn(function* ({
    kadmosName,
    client,
  }: {
    kadmosName: string;
    client: HttpClient.HttpClient;
  }) {
    const schoolLookupResponse = yield* client
      .post(untisSchoolSearchUrl, {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: HttpBody.jsonUnsafe({
          id: `studienbuch-${Date.now()}`,
          method: "searchSchool",
          params: [{ search: kadmosName.trim() }],
          jsonrpc: "2.0",
        }),
      })
      .pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(SchoolSearchResponseSchema)),
        withUntisHttpResilience("schoolLookup"),
      );

    const selectedSchool = selectSchool({
      kadmosName,
      schools: schoolLookupResponse.result.schools,
    });
    if (selectedSchool) return selectedSchool;

    const [onlySchool] = schoolLookupResponse.result.schools;
    if (schoolLookupResponse.result.schools.length === 1 && onlySchool) {
      return onlySchool;
    }

    return yield* Effect.fail(new SchoolNotFoundError({ kadmosName }));
  });

  const basicLogin = Effect.fn(function* ({
    school,
    kadmosUsername,
    kadmosPassword,
    client,
  }: {
    school: School;
    kadmosUsername: string;
    kadmosPassword: string;
    client: HttpClient.HttpClient;
  }) {
    const baseUrl = schoolBaseUrl(school);

    // First request to get the initial cookies
    yield* client
      .get(`${baseUrl}/WebUntis/`, {
        urlParams: {
          school: school.loginName,
        },
      })
      .pipe(withUntisHttpResilience("loginBootstrap"));

    const schema = Schema.Struct({
      state: Schema.Literal("SUCCESS"),
    });
    yield* client
      .post(`${baseUrl}/WebUntis/j_spring_security_check`, {
        headers: {
          accept: "application/json",
        },
        body: HttpBody.urlParams(
          UrlParams.fromInput([
            ["school", school.loginName],
            ["j_username", kadmosUsername],
            ["j_password", kadmosPassword],
            ["token", ""],
          ]),
        ),
      })
      .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)), withUntisHttpResilience("login"));
  });

  const getBearerToken = ({ client, school }: { client: HttpClient.HttpClient; school: School }) =>
    client.get(`${schoolBaseUrl(school)}/WebUntis/api/token/new`).pipe(
      Effect.flatMap((response) => response.text),
      withUntisHttpResilience("bearerToken"),
    );

  const rewriteLegacyKadmosHost = (school: School) =>
    HttpClientRequest.updateUrl((url) => url.replace(untisLegacyBaseUrl, schoolBaseUrl(school)));

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
    const baseClient = yield* HttpClient.HttpClient;
    const client = HttpClient.withCookiesRef(baseClient, cookies);

    const school = yield* resolveSchool({ kadmosName, client }).pipe(
      Effect.mapError((cause) => new LoginError({ cause, step: "schoolLookup" })),
    );

    yield* basicLogin({ school, kadmosUsername, kadmosPassword, client }).pipe(
      Effect.mapError((cause) => new LoginError({ cause, step: "login" })),
    );

    const bearerToken = yield* getBearerToken({ client, school }).pipe(
      Effect.mapError((cause) => new LoginError({ cause, step: "bearerToken" })),
    );

    return pipe(
      client,
      HttpClient.mapRequest(rewriteLegacyKadmosHost(school)),
      HttpClient.mapRequest(HttpClientRequest.setHeader("Authorization", `Bearer ${bearerToken}`)),
    );
  });

  export const provide = (credentials: { kadmosName: string; kadmosUsername: string; kadmosPassword: string }) =>
    Effect.provideServiceEffect(HttpClient.HttpClient, login(credentials));
}
