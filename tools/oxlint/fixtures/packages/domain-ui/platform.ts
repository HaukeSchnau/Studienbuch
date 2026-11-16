// One browser API per line that core and domain-ui may not reach for. A guard that stops firing
// leaves its directive unused, which fails the lint.
export const globals = [
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: window in domain-ui
  window,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: self in domain-ui
  self,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: document in domain-ui
  document,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: navigator in domain-ui
  navigator,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: location in domain-ui
  location,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: history in domain-ui
  history,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: screen in domain-ui
  screen,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: innerWidth in domain-ui
  innerWidth,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: innerHeight in domain-ui
  innerHeight,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: devicePixelRatio in domain-ui
  devicePixelRatio,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: matchMedia in domain-ui
  matchMedia,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: getComputedStyle in domain-ui
  getComputedStyle,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: scrollTo in domain-ui
  scrollTo,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: addEventListener in domain-ui
  addEventListener,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: removeEventListener in domain-ui
  removeEventListener,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: alert in domain-ui
  alert,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: confirm in domain-ui
  confirm,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: prompt in domain-ui
  prompt,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: IntersectionObserver in domain-ui
  IntersectionObserver,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: MutationObserver in domain-ui
  MutationObserver,
  // oxlint-disable-next-line eslint/no-restricted-globals -- fixture: fetch in domain-ui
  fetch,
  // oxlint-disable-next-line eslint/no-restricted-globals -- fixture: XMLHttpRequest in domain-ui
  XMLHttpRequest,
  // oxlint-disable-next-line eslint/no-restricted-globals -- fixture: WebSocket in domain-ui
  WebSocket,
  // oxlint-disable-next-line eslint/no-restricted-globals -- fixture: EventSource in domain-ui
  EventSource,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: BroadcastChannel in domain-ui
  BroadcastChannel,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: localStorage in domain-ui
  localStorage,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: sessionStorage in domain-ui
  sessionStorage,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: indexedDB in domain-ui
  indexedDB,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: caches in domain-ui
  caches,
];

export const properties = [
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: globalThis.window in domain-ui
  globalThis.window,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: globalThis.document in domain-ui
  globalThis.document,
  // oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: globalThis.location in domain-ui
  globalThis.location,
];
