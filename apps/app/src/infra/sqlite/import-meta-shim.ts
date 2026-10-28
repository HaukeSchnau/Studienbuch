// Metro turns `import.meta.url` into a lookup in a registry that only the main thread fills, and
// wa-sqlite reads it while it loads. Inside the worker it is the worker's own URL.
globalThis.__ExpoImportMetaRegistry ??= { url: self.location.href };
