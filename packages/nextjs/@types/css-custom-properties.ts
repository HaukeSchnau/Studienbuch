declare module "csstype" {
  // oxlint-disable-next-line @typescripttypescript/consistent-indexed-object-style
  interface Properties {
    [index: `--${string}`]: string | number;
  }
}
