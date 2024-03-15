import { LinearClient } from "@linear/sdk";

import { env } from "../../env";

// const linearClient = new CachingLinearClient();
const linearClient = new LinearClient({
  apiKey: env.LINEAR_API_KEY,
});

export const getLinearClient = () => {
  return linearClient;
};
