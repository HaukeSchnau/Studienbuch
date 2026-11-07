// "Öffentlicher Computer" (D44) is a browser's choice. A phone's keychain belongs to one person, so
// phones never keep their data in memory only.

/** Whether this tab keeps the account, its key and its data in memory only. Fixed at start. */
export const publicComputer = false;

/** Turns the mode on or off. On the web the tab reloads into it; phones have no such mode. */
export const setPublicComputer = (_next: boolean): void => undefined;
