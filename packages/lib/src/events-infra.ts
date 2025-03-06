import { preprocess, z } from "zod";

import type { NAMESPACES } from "./events";
import { DomainEvent, EventMetadata } from "./events";

export const Event = preprocess(
  (input) => (typeof input === "object" ? { ...input, errors: [] } : input),
  z.object({}),
)
  .and(DomainEvent)
  .and(EventMetadata);
export type Event = z.infer<typeof Event>;
export type EventName = Event["type"];
export const EVENT_TYPES = DomainEvent.options.map(
  (thing) => thing.shape.type.value,
) as [EventName, ...EventName[]]; // Assure TS that it's non-empty

export interface BaseExtra {
  initiatorUserId: string;
}

export interface EventApplicator<TEventName extends Event["type"], Extra> {
  verify: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: Extra & BaseExtra,
  ) => Promise<EventErrorsByName<TEventName>>;
  apply: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: Extra,
  ) => Promise<void>;
  topics?: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: Extra,
  ) => Promise<string[]> | string[];
}

export type PersistedEvent = Omit<Event, "errors"> & {
  initiator: string;
};

export const PublicPersistedEvent = DomainEvent.and(EventMetadata);
export type PublicPersistedEvent = z.infer<typeof PublicPersistedEvent>;

type Namespace = (typeof NAMESPACES)[number];
export type NamespaceEventApplicators<TNamespace extends Namespace, Extra> = {
  [TEventName in Event["type"] as TEventName extends `${TNamespace}.${infer T}`
    ? T
    : never]: EventApplicator<TEventName, Extra>;
};

export type EventApplicators<Extra> = {
  [TEventName in Event["type"]]?: EventApplicator<TEventName, Extra>;
} & {
  [TNamespace in Namespace]?: NamespaceEventApplicators<TNamespace, Extra>;
};

export interface EventApplicatorInterface {
  verify: <TEvent extends Event>(
    event: Omit<TEvent, "errors">,
    extra: BaseExtra,
  ) => Promise<EventErrorsByEvent<TEvent>>;
  apply: (event: Omit<Event, "errors">) => Promise<void>;
  topics?: (event: Omit<Event, "errors">) => Promise<string[]>;
}

export type EventErrorsByName<TEventName extends Event["type"]> =
  EventErrorsByEvent<Extract<Event, { type: TEventName }>>;

export type EventErrorsByEvent<TEvent extends Event> =
  | ("errors" extends keyof TEvent
      ? TEvent["errors"] extends readonly (infer E)[]
        ? E
        : TEvent["errors"]
      : never)
  | "UNEXPECTED"
  | undefined;

export type EventDataByName<TEventName extends Event["type"]> = Extract<
  Event,
  { type: TEventName }
>["data"];
