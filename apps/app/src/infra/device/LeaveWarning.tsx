// A phone keeps an app's memory when it leaves, and its accounts keep their secrets in the
// keychain, so nothing asks before the app goes.

/** Asks before a reload or closing the tab while `active`: only a browser does. */
export function LeaveWarning(_props: { readonly active: boolean }) {
  return null;
}
