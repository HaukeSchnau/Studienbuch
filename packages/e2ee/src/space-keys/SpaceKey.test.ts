import { assert, describe, it } from "@effect/vitest";
import * as Hex from "effect/encoding/Hex";

import { SpaceKey } from "./SpaceKey.ts";

const box = new SpaceKey.KeyBox({
  format: 1,
  suite: 1,
  space: "nb",
  keyEpoch: 4,
  recipient: "acc-2",
  recipientGeneration: 1,
  author: "acc-1",
  authorGeneration: 3,
  enc: Uint8Array.of(0xaa, 0xbb),
  ct: Uint8Array.of(0xcc),
  signature: new Uint8Array(64),
});

const boxInfo = [
  "7374752e6b6579626f782e7631", // "stu.keybox.v1"
  "01",
  "000000026e62", // "nb"
  "00000004",
  "000000056163632d32", // "acc-2"
  "00000001",
  "000000056163632d31", // "acc-1"
  "00000003",
].join("");

const link = new SpaceKey.HistoryLink({
  format: 1,
  suite: 1,
  space: "nb",
  keyEpoch: 5,
  author: "acc-1",
  authorGeneration: 3,
  ct: Uint8Array.of(0xcc, 0xdd),
  signature: new Uint8Array(64),
});

const linkAad = [
  "7374752e6b6579636861696e2e7631", // "stu.keychain.v1"
  "01",
  "000000026e62", // "nb"
  "00000005",
  "000000056163632d31", // "acc-1"
  "00000003",
].join("");

describe("boxInfo", () => {
  it("binds the space, the epoch and both accounts at their generations", () => {
    assert.strictEqual(Hex.encode(SpaceKey.boxInfo(box)), boxInfo);
  });
});

describe("boxSigned", () => {
  it("covers the info, the encapsulation and the ciphertext", () => {
    assert.strictEqual(Hex.encode(SpaceKey.boxSigned(box)), `${boxInfo}00000002aabb00000001cc`);
  });
});

describe("linkAad", () => {
  it("binds the space, the epoch and the author at its generation", () => {
    assert.strictEqual(Hex.encode(SpaceKey.linkAad(link)), linkAad);
  });
});

describe("linkSigned", () => {
  it("covers the associated data and the ciphertext", () => {
    assert.strictEqual(Hex.encode(SpaceKey.linkSigned(link)), `${linkAad}00000002ccdd`);
  });
});
