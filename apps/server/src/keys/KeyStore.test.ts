import { describe, expect, layer } from "@effect/vitest";
import { Keys } from "@stu/api/Keys";
import { AccountKey, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Fixture } from "../school/Fixture.ts";
import { KeyStore } from "./KeyStore.ts";

const secret = (fill: number, length = 32) => Redacted.make(new Uint8Array(length).fill(fill));

/** An account's generation 0 from a fixed root key, and its device wrapper. */
const firstDevice = (account: string, fill: number) =>
  Effect.gen(function* () {
    const keys = yield* AccountKey.derive(secret(fill), account, 0);
    const record = yield* AccountKey.record(keys, "first");

    const device = yield* Wrapper.create(
      { id: `${account}-device`, kind: "device", place: "", credentialId: "" },
      secret(fill + 1),
      keys,
    );

    return { keys, record, device: new Keys.Sealed(device) };
  });

const device = (id: string, fill: number, keys: AccountKey.Keys) =>
  Effect.map(
    Wrapper.create({ id, kind: "device", place: "", credentialId: "" }, secret(fill), keys),
    (created) => new Keys.Sealed(created),
  );

const recordJson = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(AccountKey.Record)),
);

const card = (account: string, keys: AccountKey.Keys) =>
  Effect.map(
    Wrapper.create(
      { id: `${account}-card`, kind: "code", place: "card", credentialId: "" },
      secret(3, 16),
      keys,
    ),
    (created) => new Keys.Sealed(created),
  );

/** A session of the account that signed in `minutes` ago. */
const signedIn = (account: string, minutes: number) =>
  Effect.flatMap(SqlClient.SqlClient, (sql) => {
    const id = `${account}-${minutes}`;

    return Effect.as(
      sql`
        insert into auth_session (id, "expiresAt", token, "createdAt", "userId")
        values (${id}, now() + interval '90 days', ${id}, now() - make_interval(mins => ${minutes}),
          ${account})
      `,
      id,
    );
  });

const fetches = (account: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly count: number }>`
      select count(*)::int as count from recovery_event
      where account_id = ${account} and at > now() - interval '24 hours'
    `,
  ).pipe(Effect.map(([row]) => row?.count));

describe.skipIf((Postgres18.socket ?? null) === null)("KeyStore on PostgreSQL 18", () => {
  layer(Layer.merge(Fixture.database, TestCrypto.layer("KeyStore.test")))((it) => {
    it.effect(
      "publishes generation 0 once: the same record again changes nothing, another one is refused, and of two at once one wins",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Fixture.account("lena");
          const lena = yield* firstDevice("lena", 10);
          const other = yield* firstDevice("lena", 20);
          const publish = Option.some({ wrapper: lena.device, session: "lena-0" });
          yield* sql.withTransaction(KeyStore.publishFirst("lena", lena.record, publish));
          yield* sql.withTransaction(KeyStore.publishFirst("lena", lena.record, publish));

          const refused = yield* Effect.flip(
            sql.withTransaction(KeyStore.publishFirst("lena", other.record, Option.none())),
          );

          yield* Fixture.account("tom");

          const race = yield* Effect.forEach(
            [yield* firstDevice("tom", 30), yield* firstDevice("tom", 40)],
            (tom) =>
              sql
                .withTransaction(
                  KeyStore.publishFirst(
                    "tom",
                    tom.record,
                    Option.some({ wrapper: tom.device, session: "tom-0" }),
                  ),
                )
                .pipe(
                  Effect.as("published"),
                  Effect.catchTags({ "Keys.ChainExists": (error) => Effect.succeed(error._tag) }),
                ),
            { concurrency: "unbounded" },
          );

          const state = yield* KeyStore.state("lena");

          expect({
            records: state.records.length,
            wrappers: state.wrappers.map((wrapper) => wrapper.statement.id),
            matches: AccountKey.matches(lena.keys, state.records[0] ?? other.record),
            refused: refused._tag,
            race: race.toSorted(),
            tom: (yield* KeyStore.state("tom")).wrappers.length,
          }).toEqual({
            records: 1,
            wrappers: ["lena-device"],
            matches: true,
            refused: "Keys.ChainExists",
            race: ["Keys.ChainExists", "published"],
            tom: 1,
          });
        }),
    );

    it.effect(
      "takes a Notfallkarte only from a sign-in in the last ten minutes, a device wrapper from any",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Fixture.account("mia");
          const mia = yield* firstDevice("mia", 50);
          yield* sql.withTransaction(
            KeyStore.publishFirst(
              "mia",
              mia.record,
              Option.some({ wrapper: mia.device, session: "mia-0" }),
            ),
          );
          const notfallkarte = yield* card("mia", mia.keys);
          const old = yield* signedIn("mia", 11);
          const fresh = yield* signedIn("mia", 9);

          const laptop = yield* device("mia-laptop", 51, mia.keys);

          const refused = yield* Effect.flip(KeyStore.addWrapper("mia", old, notfallkarte));
          yield* KeyStore.addWrapper("mia", old, laptop);
          yield* KeyStore.addWrapper("mia", fresh, notfallkarte);

          expect({
            refused: refused._tag,
            wrappers: (yield* KeyStore.state("mia")).wrappers.map(
              (wrapper) => wrapper.statement.id,
            ),
          }).toEqual({
            refused: "Keys.NotFresh",
            wrappers: ["mia-device", "mia-laptop", "mia-card"],
          });
        }),
    );

    it.effect(
      "refuses the 21st seal fetch in 24 hours, and records exactly the fetches that found a seal",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Fixture.account("ben");
          const ben = yield* firstDevice("ben", 60);
          yield* sql.withTransaction(
            KeyStore.publishFirst(
              "ben",
              ben.record,
              Option.some({ wrapper: ben.device, session: "ben-0" }),
            ),
          );
          yield* KeyStore.addWrapper(
            "ben",
            yield* signedIn("ben", 0),
            yield* card("ben", ben.keys),
          );

          // A fetch from yesterday no longer counts.
          yield* sql`
            insert into recovery_event (account_id, kind, method, at)
            values ('ben', 'sealsFetched', 'code', now() - interval '25 hours')
          `;

          const byCode = Keys.RecoveryCode.make({});
          const byPasskey = Keys.Passkey.make({ credentialId: "x" });
          const passkey = yield* KeyStore.fetchSeals("ben", byPasskey);
          const afterPasskey = yield* fetches("ben");
          const found = yield* KeyStore.fetchSeals("ben", byCode);
          const [sealed] = found.wrappers;

          if (sealed === undefined) return yield* Effect.die("The card's seal wasn't fetched");

          const recovered = yield* Wrapper.recover(
            "code",
            secret(3, 16),
            "ben",
            sealed.statement,
            sealed.seal,
            found.records,
          );

          yield* Effect.repeat(KeyStore.fetchSeals("ben", byCode), { times: 18 });
          const refused = yield* Effect.flip(KeyStore.fetchSeals("ben", byCode));

          expect({
            passkey: passkey.wrappers.length,
            afterPasskey,
            recovered: AccountKey.matches(recovered, ben.record),
            refused: refused._tag,
            fetches: yield* fetches("ben"),
          }).toEqual({
            passkey: 0,
            afterPasskey: 0,
            recovered: true,
            refused: "Keys.TooManyAttempts",
            fetches: 20,
          });
        }),
    );
    it.effect(
      "names the session that made a device wrapper, takes one per session, and keeps wrapper ids per account",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Fixture.account("ida");
          yield* Fixture.account("jan");
          const ida = yield* firstDevice("ida", 70);
          const phone = yield* signedIn("ida", 600);
          const laptop = yield* signedIn("ida", 1);
          const first = Option.some({ wrapper: ida.device, session: phone });
          yield* sql.withTransaction(KeyStore.publishFirst("ida", ida.record, first));
          const second = yield* device("ida-laptop", 72, ida.keys);
          const refused = yield* Effect.flip(KeyStore.addWrapper("ida", phone, second));
          yield* KeyStore.addWrapper("ida", laptop, second);

          // Another account may pick the same id for its own wrapper.
          const jan = yield* firstDevice("jan", 73);
          const sameId = yield* device("ida-device", 74, jan.keys);
          const janFirst = Option.some({ wrapper: sameId, session: yield* signedIn("jan", 0) });
          yield* sql.withTransaction(KeyStore.publishFirst("jan", jan.record, janFirst));

          const made = yield* sql<{ readonly id: string; readonly session: string }>`
            select id, created_by_session as session from key_wrapper
            where account_id = 'ida' order by created_at, id
          `;

          expect({
            refused: refused._tag === "Keys.Invalid" ? refused.reason : refused._tag,
            made,
            jan: (yield* KeyStore.state("jan")).wrappers.map((wrapper) => wrapper.statement.id),
          }).toEqual({
            refused: "limit",
            made: [
              { id: "ida-device", session: phone },
              { id: "ida-laptop", session: laptop },
            ],
            jan: ["ida-device"],
          });
        }),
    );

    it.effect(
      "takes a seal only of its format's length, and a first wrapper only while generation 0 is the newest",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Fixture.account("kai");
          const kai = yield* firstDevice("kai", 80);
          const session = yield* signedIn("kai", 0);
          const first = Option.some({ wrapper: kai.device, session });
          yield* sql.withTransaction(KeyStore.publishFirst("kai", kai.record, first));
          const notfallkarte = yield* card("kai", kai.keys);
          const { seal } = notfallkarte;

          const cut = new Keys.Sealed({
            statement: notfallkarte.statement,
            seal: new Wrapper.Seal({
              format: seal.format,
              suite: seal.suite,
              wrapperId: seal.wrapperId,
              accountId: seal.accountId,
              generation: seal.generation,
              enc: seal.enc,
              ct: seal.ct.subarray(0, 59),
            }),
          });

          const short = yield* Effect.flip(KeyStore.addWrapper("kai", session, cut));
          const keys1 = yield* AccountKey.derive(secret(81), "kai", 1);
          const record1 = yield* AccountKey.record(keys1, { keys: kai.keys, record: kai.record });

          yield* sql`
            insert into account_key (account_id, generation, record)
            values ('kai', 1, ${yield* recordJson(record1)})
          `;

          const late = Option.some({
            wrapper: yield* device("kai-laptop", 82, kai.keys),
            session: yield* signedIn("kai", 1),
          });

          const renewed = yield* Effect.flip(
            sql.withTransaction(KeyStore.publishFirst("kai", kai.record, late)),
          );

          expect({
            short: short._tag === "Keys.Invalid" ? short.reason : short._tag,
            renewed: renewed._tag,
          }).toEqual({ short: "seal", renewed: "Keys.ChainExists" });
        }),
    );
  });
});
