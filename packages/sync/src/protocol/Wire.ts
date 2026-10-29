/**
 * Every message of the protocol by the name `wire.jsonl` gives it, and their JSON Schemas. A test
 * keeps `wire.v<Protocol.version>.schema.json` equal to `schemas()`, so any change to a message
 * needs a new protocol version.
 */
import * as RpcSchema from "effect/rpc/RpcSchema";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { Tx } from "../transaction/Tx.ts";
import { Connection } from "./Connection.ts";
import { Protocol } from "./Protocol.ts";
import { Refusal } from "./Refusal.ts";

export * as Wire from "./Wire.ts";

const rpcParts = [...Protocol.Rpcs.requests].flatMap(([tag, rpc]) => {
  const parts = RpcSchema.isStreamSchema(rpc.successSchema)
    ? {
        payload: rpc.payloadSchema,
        chunk: rpc.successSchema.success,
        error: rpc.successSchema.error,
      }
    : { payload: rpc.payloadSchema, success: rpc.successSchema, error: rpc.errorSchema };

  return Object.entries(parts)
    .filter(([, { ast }]) => !SchemaAST.isNever(ast) && !SchemaAST.isVoid(ast))
    .map(([part, schema]): [string, Schema.Codec<unknown, unknown>] => [`${tag} ${part}`, schema]);
});

export const messages: ReadonlyMap<string, Schema.Codec<unknown, unknown>> = new Map([
  ...rpcParts,
  ["Refusal.Engine", Refusal.Engine],
  // A command refused because re-running its mutator failed carries the `Tx` error.
  ["Refusal.Tx", Tx.Refused],
  ["Connection.Ticket", Connection.Ticket],
]);

export const schemas = () =>
  Object.fromEntries(
    [...messages].map(([name, schema]) => [name, Schema.toJsonSchemaDocument(schema)]),
  );
