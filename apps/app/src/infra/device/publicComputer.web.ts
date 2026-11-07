import { VirtualDevice } from "./VirtualDevice.ts";

// "Öffentlicher Computer" (D44): the tab keeps its session, secrets and database in memory, so
// closing it or signing out leaves nothing behind. The choice lives in the tab's sessionStorage,
// which the browser drops with the tab, and takes effect when the tab starts, because the device's
// storage is chosen then.

const key = `studienbuch:${VirtualDevice.current}:public-computer`;

/** Whether this tab keeps the account, its key and its data in memory only. Fixed at start. */
export const publicComputer = sessionStorage.getItem(key) === "1";

/** Turns the mode on or off by reloading the tab into it, before anyone signs in. */
export const setPublicComputer = (next: boolean): void => {
  if (next === publicComputer) return;

  if (next) {
    sessionStorage.setItem(key, "1");
  } else {
    sessionStorage.removeItem(key);
  }

  window.location.reload();
};
