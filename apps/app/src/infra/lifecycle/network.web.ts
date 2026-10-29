// The browser's network, which is what expo-network's web module reads as well.

/** Whether the browser reports a network now. */
export const onlineNow = () => Promise.resolve(navigator.onLine);

/** Calls `listener` on each change, until the returned function is called. */
export const onOnlineChange = (listener: (online: boolean) => void) => {
  const online = () => listener(true);
  const offline = () => listener(false);

  window.addEventListener("online", online);
  window.addEventListener("offline", offline);

  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
};
