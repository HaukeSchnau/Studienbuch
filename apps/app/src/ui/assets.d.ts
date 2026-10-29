// On the web, Metro turns an imported font file into its URL.
declare module "*.woff2" {
  const url: string;
  export default url;
}

// Metro turns an imported image into a source for `<Image>`.
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";

  const source: ImageSourcePropType;
  export default source;
}
