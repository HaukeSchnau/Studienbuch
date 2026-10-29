import { describe, expect, layer } from "@effect/vitest";
import { Keys } from "@stu/api/Keys";
import { AccountKey, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
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

describe.skipIf(Postgres18.socket === null)("KeyStore on PostgreSQL 18", () => {
  layer(Layer.merge(Fixture.database, TestCrypto.layer("KeyStore.test")))((it) => {
    it.effect(
      "publishes generation 0 once: the same record again changes nothing, another one is refused, and of two at once one wins",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Fixture.account("lena");
          const lena = yield* firstDevice("lena", 10);
          const other = yield* firstDevice("lena", 20);
          const publish = Option.some(lena.device);
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
                .withTransaction(KeyStore.publishFirst("tom", tom.record, Option.some(tom.device)))
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
            KeyStore.publishFirst("mia", mia.record, Option.some(mia.device)),
          );
          const notfallkarte = yield* card("mia", mia.keys);
          const old = yield* signedIn("mia", 11);
          const fresh = yield* signedIn("mia", 9);

          const laptop = yield* Wrapper.create(
            { id: "mia-laptop", kind: "device", place: "", credentialId: "" },
            secret(51),
            mia.keys,
          );

          const refused = yield* Effect.flip(KeyStore.addWrapper("mia", old, notfallkarte));
          yield* KeyStore.addWrapper("mia", old, new Keys.Sealed(laptop));
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
            KeyStore.publishFirst("ben", ben.record, Option.some(ben.device)),
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
  });
});
