import * as Network from "expo-network";

// The platform's network on iOS and Android. `network.web.ts` is the browser's.

// A network that Android hasn't probed yet reports no reachability, so a connection counts.
const online = (state: Network.NetworkState) =>
  state.isInternetReachable ?? state.isConnected ?? true;

/** Whether the platform reports a network now. */
export const onlineNow = () => Network.getNetworkStateAsync().then(online);

/** Calls `listener` on each change, until the returned function is called. */
export const onOnlineChange = (listener: (online: boolean) => void) => {
  const subscription = Network.addNetworkStateListener((state) => listener(online(state)));

  return () => subscription.remove();
};
