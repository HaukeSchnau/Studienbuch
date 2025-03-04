import type { Entity, EntityType } from "./entities";
import type { EventDataByName, EventName } from "./events-infra";

interface Event<TName extends string, TData> {
  type: TName;
  data: TData;
  timestamp: Date;
}

interface MetadataBuilder<TName extends EventName> {
  entityIds: (data: EventDataByName<TName>) => Entity[];
  recipients: (data: EventDataByName<TName>) => string[];
}

interface EventHandler<TName extends EventName> {
  verify: (event: Event<TName, EventDataByName<TName>>) => boolean;
  apply: (event: Event<TName, EventDataByName<TName>>) => void;
}

interface EntityHandler<
  TType extends EntityType,
  Extra = unknown,
  ServerSideExtra = unknown,
  TOut = unknown,
> {
  // Executed on the server
  getSnapshot: (
    id: Extract<Entity, { type: TType }>,
    extra: ServerSideExtra,
  ) => TOut;
  applySnapshot: (snapshot: TOut, extra: Extra) => void;
}

// entity handler helper
const ehh = <
  TType extends EntityType,
  Extra = unknown,
  ServerSideExtra = unknown,
  TOut = unknown,
>(
  handler: EntityHandler<TType, Extra, ServerSideExtra, TOut>,
) => {
  return handler;
};

type EntityHandlers<Extra, ServerSideExtra> = {
  [TType in EntityType]?: EntityHandler<TType, Extra, ServerSideExtra, any>;
};

const someEntityHandlers: EntityHandlers<unknown, unknown> = {
  class: ehh({
    getSnapshot(id, extra) {
      return {
        thing: id.school,
      };
    },
    applySnapshot(snapshot, extra) {
      console.log(snapshot.thing);
    },
  }),
};
