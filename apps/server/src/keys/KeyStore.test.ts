import { describe, expect, layer } from "@effect/vitest";
import { Keys } from "@stu/api/Keys";
import { AccountKey, SpaceKey, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Postgres18 } from "@stu/sync/testing";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Pool } from "pg";
import { Deletion } from "../account/Deletion.ts";
import { CardLogins } from "../auth/CardLogins.ts";
import { FreshSignIn } from "../auth/FreshSignIn.ts";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { SchoolTesting } from "../school/SchoolTesting.ts";
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

const boxJson = Schema.encodeEffect(Schema.fromJsonString(Schema.toCodecJson(SpaceKey.KeyBox)));

/**
 * A notebook of `account`'s with key epoch 0, as the sync server stores it once sealed: by
 * default the account owns it and its first sealed write left a key box signed by `keys`.
 */
const sealedNotebook = (
  account: string,
  keys: AccountKey.Keys,
  record: AccountKey.Record,
  { role = "owner", box = true }: { readonly role?: string; readonly box?: boolean } = {},
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const space = `nb-${account}-${role}`;
    const key = yield* SpaceKey.generate;
    const sealed = yield* SpaceKey.box(space, [{ epoch: 0, key }], record, keys);

    yield* sql`insert into space (id, kind, version, key_epoch) values (${space}, 'notebook', 1, 0)`;
    yield* sql`insert into space_member (space_id, account_id, role) values (${space}, ${account}, ${role})`;

    if (!box) return;

    yield* sql`
      insert into sync_row (space_id, tbl, id, version, data)
      values (${space}, '_key', ${`${account}:0`}, 1, ${yield* boxJson(sealed)}::jsonb)
    `;
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

/** Another Notfallkarte of the account, from the card `fill` makes, saved in `place`. */
const cardFrom = (
  id: string,
  fill: number,
  keys: AccountKey.Keys,
  place: "card" | "passwordManager" = "card",
) =>
  Effect.map(
    Wrapper.create({ id, kind: "code", place, credentialId: "" }, secret(fill, 16), keys),
    (created) => new Keys.Sealed(created),
  );

/** An account without an address, as a sign-up without one leaves it. */
const withoutAddress = (id: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql`
      insert into auth_user (id, name, email, "emailVerified")
      values (${id}, '', ${`${id}x9@konto.placeholder.invalid`}, false)
    `,
  );

/**
 * Stops the next `armed` asks for random bytes, each telling `held` and waiting for one `release`.
 * A card replacement asks after its locks, for its new login's row id.
 */
class Pause extends Context.Service<
  Pause,
  {
    readonly armed: Ref.Ref<number>;
    readonly held: Queue.Queue<void>;
    readonly release: Queue.Queue<void>;
  }
>()("Test.Pause") {}

/** `SchoolTesting.database` with a `Crypto` that `Pause` stops. */
const pausing = Layer.effect(Crypto.Crypto)(
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const pause = yield* Pause;

    return {
      ...crypto,
      randomBytes: (size: number) =>
        Effect.andThen(
          Effect.flatMap(
            Ref.modify(pause.armed, (left) => [left > 0, Math.max(0, left - 1)] as const),
            (stops) =>
              stops
                ? Effect.andThen(Queue.offer(pause.held, undefined), Queue.take(pause.release))
                : Effect.void,
          ),
          crypto.randomBytes(size),
        ),
    };
  }),
).pipe(
  Layer.provideMerge(
    Layer.effect(Pause)(
      Effect.all({
        armed: Ref.make(0),
        held: Queue.unbounded<void>(),
        release: Queue.unbounded<void>(),
      }),
    ),
  ),
  Layer.provideMerge(SchoolTesting.database),
);

/**
 * An account without an address, signed in a moment ago, with its keys and a first card whose
 * login `fill` makes, and `replace`, which adds a new card with a new login, as a device does.
 */
const cardAccount = (account: string, fill: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* withoutAddress(account);
    const first = yield* firstDevice(account, fill);
    const session = yield* signedIn(account, 0);
    const device = Option.some({ wrapper: first.device, session });
    yield* sql.withTransaction(KeyStore.publishFirst(account, first.record, device));
    const card = yield* cardFrom(`${account}-card-1`, fill + 1, first.keys);
    yield* KeyStore.addWrapper(account, session, card, Option.some(loginOf(fill + 1)));

    return {
      replace: (id: string, cardFill: number, login: string) =>
        Effect.flatMap(cardFrom(id, cardFill, first.keys), (wrapper) =>
          KeyStore.addWrapper(account, session, wrapper, Option.some(login)),
        ),
    };
  });

/** A card's login as the device sends it: 32 bytes, base64url. */
const loginOf = (fill: number) => Base64Url.encode(new Uint8Array(32).fill(fill));

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
  layer(Layer.merge(SchoolTesting.database, TestCrypto.layer("KeyStore.test")))((it) => {
    it.effect(
      "publishes generation 0 once: the same record again changes nothing, another one is refused, and of two at once one wins",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* SchoolTesting.account("lena");
          const lena = yield* firstDevice("lena", 10);
          const other = yield* firstDevice("lena", 20);
          const publish = Option.some({ wrapper: lena.device, session: "lena-0" });
          yield* sql.withTransaction(KeyStore.publishFirst("lena", lena.record, publish));
          yield* sql.withTransaction(KeyStore.publishFirst("lena", lena.record, publish));

          const refused = yield* Effect.flip(
            sql.withTransaction(KeyStore.publishFirst("lena", other.record, Option.none())),
          );

          yield* SchoolTesting.account("tom");

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

    // Device 1 sends card A and loses the answer. Device 2 replaces A with B. Device 1 then sends A
    // again, still fresh: that must not make the retired card the account's card again.
    it.effect("a card a newer card retired stays retired when a device resends it", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        const ids = (account: string) =>
          Effect.map(KeyStore.state(account), (state) =>
            state.wrappers.map((wrapper) => wrapper.statement.id),
          );

        const replay = (account: string, address: boolean, fill: number) =>
          Effect.gen(function* () {
            if (address) yield* SchoolTesting.account(account);
            else yield* withoutAddress(account);

            const first = yield* firstDevice(account, fill);
            const one = yield* signedIn(account, 1);
            const two = yield* signedIn(account, 2);
            yield* sql.withTransaction(
              KeyStore.publishFirst(
                account,
                first.record,
                Option.some({ wrapper: first.device, session: one }),
              ),
            );

            const a = yield* cardFrom(`${account}-card-a`, fill + 1, first.keys);
            const b = yield* cardFrom(`${account}-card-b`, fill + 2, first.keys);
            const c = yield* cardFrom(`${account}-card-c`, fill + 3, first.keys);
            const loginA = Option.some(loginOf(fill + 1));
            const loginB = Option.some(loginOf(fill + 2));

            yield* KeyStore.addWrapper(account, one, a, loginA);
            yield* KeyStore.addWrapper(account, two, b, loginB);

            // B signed out device 1 of an account without an address; it signs in again, as with
            // its passkey, and still holds A.
            const again = yield* signedIn(account, 3);
            const replayed = yield* Effect.flip(KeyStore.addWrapper(account, again, a, loginA));
            // Device 2 resends its own card after a lost answer: nothing changes.
            yield* KeyStore.addWrapper(account, two, b, loginB);
            const afterReplay = yield* ids(account);

            const logins = [
              yield* CardLogins.owner(loginOf(fill + 1)),
              yield* CardLogins.owner(loginOf(fill + 2)),
            ];

            // A genuinely new card still replaces B.
            yield* KeyStore.addWrapper(account, two, c, Option.some(loginOf(fill + 3)));

            return {
              replayed: replayed._tag === "Keys.Invalid" ? replayed.reason : replayed._tag,
              afterReplay,
              logins: address ? [] : logins,
              afterNew: yield* ids(account),
            };
          });

        expect({
          email: yield* replay("rufus", true, 140),
          withoutAddress: yield* replay("wanda", false, 150),
        }).toEqual({
          email: {
            replayed: "statement",
            afterReplay: ["rufus-device", "rufus-card-b"],
            logins: [],
            afterNew: ["rufus-device", "rufus-card-c"],
          },
          withoutAddress: {
            replayed: "statement",
            afterReplay: ["wanda-device", "wanda-card-b"],
            logins: [Option.none(), Option.some("wanda")],
            afterNew: ["wanda-device", "wanda-card-c"],
          },
        });
      }),
    );

    it.effect(
      "takes a Notfallkarte only from a sign-in in the last ten minutes, a device wrapper from any",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* SchoolTesting.account("mia");
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

          const refused = yield* Effect.flip(
            KeyStore.addWrapper("mia", old, notfallkarte, Option.none()),
          );

          yield* KeyStore.addWrapper("mia", old, laptop, Option.none());
          yield* KeyStore.addWrapper("mia", fresh, notfallkarte, Option.none());

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
      "refuses the 21st seal fetch in 24 hours, records exactly the fetches that found a seal, and the sweep deletes only those older than 12 months",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* SchoolTesting.account("ben");
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
            Option.none(),
          );

          // A fetch from yesterday no longer counts.
          yield* sql`
            insert into recovery_event (account_id, kind, method, at)
            values ('ben', 'sealsFetched', 'code', now() - interval '25 hours')
          `;

          // One second inside and outside 12 months before the sweep's time.
          yield* sql`
            insert into recovery_event (account_id, kind, method, credential_id, at)
            values ('ben', 'sealsFetched', 'prf', 'inside', '2025-11-27T12:00:01Z'),
              ('ben', 'sealsFetched', 'prf', 'outside', '2025-11-27T11:59:59Z')
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
          yield* KeyStore.sweepFetches(DateTime.makeUnsafe("2026-11-27T12:00:00Z"));
          const refused = yield* Effect.flip(KeyStore.fetchSeals("ben", byCode));

          const old = yield* sql<{ readonly credential_id: string }>`
            select credential_id from recovery_event
            where account_id = 'ben' and credential_id is not null
          `;

          expect({
            passkey: passkey.wrappers.length,
            afterPasskey,
            recovered: AccountKey.matches(recovered, ben.record),
            refused: refused._tag,
            fetches: yield* fetches("ben"),
            old: old.map((row) => row.credential_id),
          }).toEqual({
            passkey: 0,
            afterPasskey: 0,
            recovered: true,
            refused: "Keys.TooManyAttempts",
            fetches: 20,
            old: ["inside"],
          });
        }),
    );
    it.effect(
      "signs in with the card of an account without an address, and a new card retires the old one's login, and for every account its wrappers",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* withoutAddress("noa");
          const noa = yield* firstDevice("noa", 100);
          const session = yield* signedIn("noa", 0);
          // The device of someone who found the first card and signed in with it.
          const finder = yield* signedIn("noa", 30);
          const first = Option.some({ wrapper: noa.device, session });
          yield* sql.withTransaction(KeyStore.publishFirst("noa", noa.record, first));

          const add = (wrapper: Keys.Sealed, login: Option.Option<string>) =>
            KeyStore.addWrapper("noa", session, wrapper, login);

          const owner = (fill: number) => CardLogins.owner(loginOf(fill));

          const card1 = yield* cardFrom("noa-card-1", 101, noa.keys);
          // The app one release back sends no login: such a card couldn't sign in.
          const withoutLogin = yield* Effect.flip(add(card1, Option.none()));
          yield* add(card1, Option.some(loginOf(1)));
          // The same card in the password manager is the same card.
          yield* add(
            yield* cardFrom("noa-card-1-saved", 101, noa.keys, "passwordManager"),
            Option.some(loginOf(1)),
          );

          const sessions = Effect.map(
            sql<{
              readonly id: string;
            }>`select id from auth_session where "userId" = 'noa' order by id`,
            (rows) => rows.map(({ id }) => id),
          );

          const firstCard = {
            owner: yield* owner(1),
            wrappers: (yield* KeyStore.state("noa")).wrappers.length,
            sessions: yield* sessions,
          };

          // A new card signs out the finder of the old one, as a new password would.
          const ended = yield* add(
            yield* cardFrom("noa-card-2", 102, noa.keys),
            Option.some(loginOf(2)),
          );

          // Another account can't take Noa's card, nor an email account's card sign in.
          yield* withoutAddress("eli");
          const eli = yield* firstDevice("eli", 110);
          const eliSession = yield* signedIn("eli", 0);
          yield* sql.withTransaction(
            KeyStore.publishFirst(
              "eli",
              eli.record,
              Option.some({ wrapper: eli.device, session: eliSession }),
            ),
          );

          const taken = yield* Effect.flip(
            KeyStore.addWrapper(
              "eli",
              eliSession,
              yield* cardFrom("eli-card", 111, eli.keys),
              Option.some(loginOf(2)),
            ),
          );

          yield* SchoolTesting.account("max");
          const max = yield* firstDevice("max", 120);
          const maxSession = yield* signedIn("max", 0);
          yield* sql.withTransaction(
            KeyStore.publishFirst(
              "max",
              max.record,
              Option.some({ wrapper: max.device, session: maxSession }),
            ),
          );
          yield* KeyStore.addWrapper(
            "max",
            maxSession,
            yield* card("max", max.keys),
            Option.some(loginOf(3)),
          );

          // An email account's card opens the notebook only, and a new one retires it too.
          yield* KeyStore.addWrapper(
            "max",
            maxSession,
            yield* cardFrom("max-card-2", 121, max.keys),
            Option.some(loginOf(4)),
          );

          expect({
            withoutLogin:
              withoutLogin._tag === "Keys.Invalid" ? withoutLogin.reason : withoutLogin._tag,
            firstCard,
            card1: yield* owner(1),
            card2: yield* owner(2),
            wrappers: (yield* KeyStore.state("noa")).wrappers.map(
              (wrapper) => wrapper.statement.id,
            ),
            seals: (yield* sql`select 1 from key_wrapper_seal where account_id = 'noa'`).length,
            taken: taken._tag === "Keys.Invalid" ? taken.reason : taken._tag,
            email: yield* owner(3),
            emailWrappers: (yield* KeyStore.state("max")).wrappers.map(
              (wrapper) => wrapper.statement.id,
            ),
            ended,
            sessions: yield* sessions,
          }).toEqual({
            withoutLogin: "statement",
            firstCard: {
              owner: Option.some("noa"),
              wrappers: 3,
              sessions: [session, finder].sort(),
            },
            card1: Option.none(),
            card2: Option.some("noa"),
            wrappers: ["noa-device", "noa-card-2"],
            seals: 2,
            taken: "statement",
            email: Option.none(),
            emailWrappers: ["max-device", "max-card-2"],
            ended: [finder],
            sessions: [session],
          });
        }),
    );
    it.effect(
      "names the session that made a device wrapper, takes one per session, and keeps wrapper ids per account",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* SchoolTesting.account("ida");
          yield* SchoolTesting.account("jan");
          const ida = yield* firstDevice("ida", 70);
          const phone = yield* signedIn("ida", 600);
          const laptop = yield* signedIn("ida", 1);
          const first = Option.some({ wrapper: ida.device, session: phone });
          yield* sql.withTransaction(KeyStore.publishFirst("ida", ida.record, first));
          const second = yield* device("ida-laptop", 72, ida.keys);

          const refused = yield* Effect.flip(
            KeyStore.addWrapper("ida", phone, second, Option.none()),
          );

          yield* KeyStore.addWrapper("ida", laptop, second, Option.none());

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
          yield* SchoolTesting.account("kai");
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

          const short = yield* Effect.flip(KeyStore.addWrapper("kai", session, cut, Option.none()));
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

          // A Seal's signatures are checked against the newest record.
          const newest = Option.map(yield* KeyStore.newest("kai"), (record) => record.generation);

          expect({
            short: short._tag === "Keys.Invalid" ? short.reason : short._tag,
            renewed: renewed._tag,
            newest,
          }).toEqual({ short: "seal", renewed: "Keys.ChainExists", newest: Option.some(1) });
        }),
    );
    it.effect(
      "starts no second chain for an account whose own notebook was sealed by another key, without a transaction too",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          const records = (account: string) =>
            Effect.map(KeyStore.state(account), (state) => state.records.length);

          // The server lost Lea's key records, or never had them: her notebook still has its box.
          yield* SchoolTesting.account("lea");
          const lea = yield* firstDevice("lea", 90);
          const other = yield* firstDevice("lea", 91);
          yield* sealedNotebook("lea", lea.keys, lea.record);
          // Like the demo seed, outside any transaction.

          const second = yield* Effect.flip(
            KeyStore.publishFirst("lea", other.record, Option.none()),
          );

          const afterSecond = yield* records("lea");
          yield* sql.withTransaction(KeyStore.publishFirst("lea", lea.record, Option.none()));
          const [back] = (yield* KeyStore.state("lea")).records;

          // A key epoch without a box to compare with, and a notebook Ole only reads, block nothing.
          yield* SchoolTesting.account("uta");
          const uta = yield* firstDevice("uta", 92);
          yield* sealedNotebook("uta", uta.keys, uta.record, { box: false });
          yield* KeyStore.publishFirst("uta", uta.record, Option.none());
          yield* SchoolTesting.account("ole");
          const ole = yield* firstDevice("ole", 93);
          const owner = yield* firstDevice("ole", 94);
          yield* sealedNotebook("ole", owner.keys, owner.record, { role: "reader" });
          yield* KeyStore.publishFirst("ole", ole.record, Option.none());

          expect({
            second: second._tag,
            afterSecond,
            back: back !== undefined && AccountKey.matches(lea.keys, back),
            uta: yield* records("uta"),
            ole: yield* records("ole"),
          }).toEqual({ second: "Keys.KeysLost", afterSecond: 0, back: true, uta: 1, ole: 1 });
        }),
    );
  });
  // Pia replaces her Notfallkarte on her phone while her laptop adds its own wrapper and fetches
  // seals. The replacement holds her logins for update from its start, so the others wait for it
  // instead of holding her logins while it waits for her key record.
  layer(Layer.mergeAll(pausing, TestCrypto.layer("KeyStore.test")))((it) => {
    it.effect("a card replacement and other key writes of the account all finish", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const pause = yield* Pause;
        yield* withoutAddress("pia");
        const pia = yield* firstDevice("pia", 140);
        const session = yield* signedIn("pia", 0);
        const laptopSession = yield* signedIn("pia", 1);
        const first = Option.some({ wrapper: pia.device, session });
        yield* sql.withTransaction(KeyStore.publishFirst("pia", pia.record, first));
        yield* KeyStore.addWrapper(
          "pia",
          session,
          yield* cardFrom("pia-card-1", 141, pia.keys),
          Option.some(loginOf(41)),
        );

        // The next card's replacement stops after its locks, when it asks for its login's row id.
        yield* Ref.set(pause.armed, 1);

        const replacing = yield* Effect.forkChild(
          KeyStore.addWrapper(
            "pia",
            session,
            yield* cardFrom("pia-card-2", 142, pia.keys),
            Option.some(loginOf(42)),
          ),
        );

        yield* Queue.take(pause.held);

        const laptop = yield* Effect.forkChild(
          KeyStore.addWrapper(
            "pia",
            laptopSession,
            yield* device("pia-laptop", 143, pia.keys),
            Option.none(),
          ),
        );

        const fetching = yield* Effect.forkChild(
          KeyStore.fetchSeals("pia", Keys.RecoveryCode.make({})),
        );

        // Both wait for the replacement's locks before it goes on.
        yield* DatabaseTesting.waiting(2);

        yield* Queue.offer(pause.release, undefined);

        const exits = {
          replacing: yield* Fiber.await(replacing),
          laptop: yield* Fiber.await(laptop),
          fetching: yield* Fiber.await(fetching),
        };

        expect({
          replacing: Exit.isSuccess(exits.replacing),
          laptop: Exit.isSuccess(exits.laptop),
          fetching: Exit.isSuccess(exits.fetching),
          card: Option.isSome(yield* CardLogins.owner(loginOf(42))),
        }).toEqual({ replacing: true, laptop: true, fetching: true, card: true });
      }),
    );

    // Rio replaces his card on his phone (a), then again on his laptop (b), which waits for (a).
    // While (b) replaces, a seal fetch comes in, after (a)'s new login was in place.
    it.effect("a replacement queued behind another, and a seal fetch after it, all finish", () =>
      Effect.gen(function* () {
        const pause = yield* Pause;
        const rio = yield* cardAccount("rio", 150);
        yield* Ref.set(pause.armed, 2);

        const a = yield* Effect.forkChild(rio.replace("rio-card-2", 152, loginOf(52)));
        yield* Queue.take(pause.held);
        const b = yield* Effect.forkChild(rio.replace("rio-card-3", 153, loginOf(53)));
        yield* DatabaseTesting.waiting(1);
        yield* Queue.offer(pause.release, undefined);
        yield* Queue.take(pause.held);

        const fetching = yield* Effect.forkChild(
          KeyStore.fetchSeals("rio", Keys.RecoveryCode.make({})),
        );

        yield* DatabaseTesting.waiting(1);
        yield* Queue.offer(pause.release, undefined);

        expect({
          a: Exit.isSuccess(yield* Fiber.await(a)),
          b: Exit.isSuccess(yield* Fiber.await(b)),
          fetching: Exit.isSuccess(yield* Fiber.await(fetching)),
          card: Option.isSome(yield* CardLogins.owner(loginOf(53))),
        }).toEqual({ a: true, b: true, fetching: true, card: true });
      }),
    );

    it.effect("replacements queued one behind the other all finish", () =>
      Effect.gen(function* () {
        const pause = yield* Pause;
        const ria = yield* cardAccount("ria", 160);
        yield* Ref.set(pause.armed, 2);

        const a = yield* Effect.forkChild(ria.replace("ria-card-2", 162, loginOf(62)));
        yield* Queue.take(pause.held);
        const b = yield* Effect.forkChild(ria.replace("ria-card-3", 163, loginOf(63)));
        yield* DatabaseTesting.waiting(1);
        yield* Queue.offer(pause.release, undefined);
        yield* Queue.take(pause.held);
        const c = yield* Effect.forkChild(ria.replace("ria-card-4", 164, loginOf(64)));
        yield* DatabaseTesting.waiting(1);
        yield* Queue.offer(pause.release, undefined);

        expect({
          a: Exit.isSuccess(yield* Fiber.await(a)),
          b: Exit.isSuccess(yield* Fiber.await(b)),
          c: Exit.isSuccess(yield* Fiber.await(c)),
          last: Option.isSome(yield* CardLogins.owner(loginOf(64))),
          retired: Option.isNone(yield* CardLogins.owner(loginOf(62))),
        }).toEqual({ a: true, b: true, c: true, last: true, retired: true });
      }),
    );

    // Someone signed in with Noor's old card asks to delete her account while she replaces the
    // card. The deletion waits for the replacement, which ends that session, and then refuses.
    it.effect("a deletion queued behind a replacement checks its sign-in after it", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const pause = yield* Pause;
        const noor = yield* cardAccount("noor", 180);
        const finder = yield* signedIn("noor", 1);

        yield* Ref.set(pause.armed, 1);
        const replacing = yield* Effect.forkChild(noor.replace("noor-card-2", 182, loginOf(82)));
        yield* Queue.take(pause.held);

        const fresh = Effect.flatMap(FreshSignIn.isFresh("noor", finder), (isFresh) =>
          isFresh ? Effect.void : Effect.fail("not-fresh" as const),
        );

        const deleting = yield* Effect.forkChild(
          Deletion.run("noor", fresh).pipe(Effect.provide(Deletion.ended)),
        );

        yield* DatabaseTesting.waiting(1);
        yield* Queue.offer(pause.release, undefined);

        expect({
          replacing: Exit.isSuccess(yield* Fiber.await(replacing)),
          deleting: Exit.match(yield* Fiber.await(deleting), {
            onSuccess: () => "deleted",
            onFailure: (cause) => Cause.findErrorOption(cause),
          }),
          left: (yield* sql`select 1 from auth_user where id = 'noor'`).length,
        }).toEqual({ replacing: true, deleting: Option.some("not-fresh"), left: 1 });
      }),
    );

    // Sia replaces her card, and her deletion queues behind it. Right after, a device signs in with
    // the new card, through Better Auth's own pool for its session.
    it.effect(
      "a deletion queued behind a replacement, and a card sign-in after it, all finish",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const pause = yield* Pause;
          const sia = yield* cardAccount("sia", 170);

          const [database] = yield* sql<{
            readonly name: string;
          }>`select current_database() as name`;

          const socket = encodeURIComponent(Postgres18.socket ?? "");

          const pool = yield* Effect.acquireRelease(
            Effect.sync(
              () =>
                new Pool({
                  connectionString: `postgresql://postgres@localhost/${database?.name}?host=${socket}`,
                  statement_timeout: 15_000,
                }),
            ),
            (opened) => Effect.promise(() => opened.end()),
          );

          yield* Ref.set(pause.armed, 1);
          const replacing = yield* Effect.forkChild(sia.replace("sia-card-2", 172, loginOf(72)));
          yield* Queue.take(pause.held);

          const deleting = yield* Effect.forkChild(
            Deletion.run("sia").pipe(Effect.provide(Deletion.ended)),
          );

          yield* DatabaseTesting.waiting(1);
          yield* Queue.offer(pause.release, undefined);

          const signingIn = yield* Effect.forkChild(
            CardLogins.signingIn(loginOf(72), (account) =>
              Effect.tryPromise(() =>
                pool.query(
                  `insert into auth_session (id, "expiresAt", token, "userId")
                 values ('sia-card-session', now() + interval '1 day', 'token-sia-card', $1)`,
                  [account],
                ),
              ),
            ),
          );

          const finished = (fiber: Fiber.Fiber<unknown, unknown>) =>
            Effect.map(
              Effect.timeoutOption(Fiber.await(fiber), "10 seconds"),
              Option.exists(Exit.isSuccess),
            );

          expect({
            replacing: yield* finished(replacing),
            deleting: yield* finished(deleting),
            signingIn: yield* finished(signingIn),
            left: Number(
              (yield* sql<{ readonly count: number }>`
            select (select count(*) from auth_user where id = 'sia')
              + (select count(*) from auth_account where "userId" = 'sia')
              + (select count(*) from auth_session where "userId" = 'sia')
              + (select count(*) from account_key where account_id = 'sia') as count
          `)[0]?.count,
            ),
          }).toEqual({ replacing: true, deleting: true, signingIn: true, left: 0 });
        }),
    );
  });
});
