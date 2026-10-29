/**
 * Each encrypted space has one 32-byte key per epoch. A key box (table `_key`) delivers keys to one
 * member account, and a history link (table `_keychain`) holds the previous epoch's key under the
 * current one, so the current key walks back to epoch 0. The author signs both with the identity
 * key of `authorGeneration`, so the server checks them without opening them.
 *
 * ```text
 * format 1   box info  = "stu.keybox.v1" || u8(suite) || text(space) || u32(keyEpoch)
 *                        || text(recipient) || u32(recipientGeneration)
 *                        || text(author) || u32(authorGeneration)
 *            (ss, enc) = X-Wing.Encaps(the recipient's sealing key of recipientGeneration)
 *            k         = HKDF-SHA256(ikm = ss, salt = empty, info = box info, 32)
 *            payload   = u32(n) || n × (u32(epoch) || key(32)), keyEpoch's key first, then
 *                        older keys for a member who may read history
 *            box ct    = nonce(12) || AES-256-GCM(k, nonce, payload, aad = box info)
 *            box sig   = Ed25519(AIK of author at authorGeneration, box info || lp(enc) || lp(ct))
 *
 *            link aad  = "stu.keychain.v1" || u8(suite) || text(space) || u32(keyEpoch)
 *                        || text(author) || u32(authorGeneration)
 *            link ct   = nonce(12) || AES-256-GCM(K_keyEpoch, nonce, K_(keyEpoch - 1), link aad)
 *            link sig  = Ed25519(AIK of author at authorGeneration, link aad || lp(ct))
 *
 * A space that hides history from a new member leaves out the link at the epoch made for the join.
 * ```
 */
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";

export * as SpaceKey from "./SpaceKey.ts";

/** The format this build writes, for boxes and links alike. */
export const format = 1;

export class KeyBox extends Schema.Class<KeyBox, { readonly brand: unique symbol }>(
  "SpaceKey.KeyBox",
)({
  format: Bytes.U8,
  suite: Bytes.U8,
  space: Schema.String,
  /** The newest epoch whose key the box carries. */
  keyEpoch: Bytes.U32,
  /** The member account the box is for. */
  recipient: Schema.String,
  /** The generation of the recipient's account key whose sealing key opens the box. */
  recipientGeneration: Bytes.U32,
  author: Schema.String,
  authorGeneration: Bytes.U32,
  enc: Schema.Uint8Array,
  ct: Schema.Uint8Array,
  signature: Schema.Uint8Array,
}) {}

export class HistoryLink extends Schema.Class<HistoryLink, { readonly brand: unique symbol }>(
  "SpaceKey.HistoryLink",
)({
  format: Bytes.U8,
  suite: Bytes.U8,
  space: Schema.String,
  /** The epoch whose key encrypts the link. It holds the key of the epoch before, so at least 1. */
  keyEpoch: Bytes.U32.check(Schema.isGreaterThanOrEqualTo(1)),
  author: Schema.String,
  authorGeneration: Bytes.U32,
  ct: Schema.Uint8Array,
  signature: Schema.Uint8Array,
}) {}

/** A box's key derivation info, which is also its associated data. */
export const boxInfo = (box: KeyBox): Uint8Array =>
  Bytes.concat(
    Bytes.utf8("stu.keybox.v1"),
    Bytes.u8(box.suite),
    Bytes.text(box.space),
    Bytes.u32(box.keyEpoch),
    Bytes.text(box.recipient),
    Bytes.u32(box.recipientGeneration),
    Bytes.text(box.author),
    Bytes.u32(box.authorGeneration),
  );

/** What a box's author signs. */
export const boxSigned = (box: KeyBox): Uint8Array =>
  Bytes.concat(boxInfo(box), Bytes.lp(box.enc), Bytes.lp(box.ct));

/** A link's associated data. */
export const linkAad = (link: HistoryLink): Uint8Array =>
  Bytes.concat(
    Bytes.utf8("stu.keychain.v1"),
    Bytes.u8(link.suite),
    Bytes.text(link.space),
    Bytes.u32(link.keyEpoch),
    Bytes.text(link.author),
    Bytes.u32(link.authorGeneration),
  );

/** What a link's author signs. */
export const linkSigned = (link: HistoryLink): Uint8Array =>
  Bytes.concat(linkAad(link), Bytes.lp(link.ct));
