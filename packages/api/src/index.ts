export * as AccessApi from "./access";
export * as MarketingApi from "./marketing";

import { Rpcs as AccessRpcs } from "./access";
import { Rpcs as MarketingRpcs } from "./marketing";

/** Every first-party application command and query served by `/api/rpc`. */
export const Rpcs = AccessRpcs.merge(MarketingRpcs);
