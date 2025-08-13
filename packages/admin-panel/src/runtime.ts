import { DatabaseLive, PersonRepository } from "@stu/db";
import { Layer, ManagedRuntime } from "effect";

export const runtime = ManagedRuntime.make(Layer.merge(DatabaseLive, PersonRepository.Default));
