type LocalFontSource =
  | string
  | ReadonlyArray<{
      path: string;
      style?: string;
      weight?: string;
    }>;

type LocalFontOptions = {
  src: LocalFontSource;
  variable?: string;
};

type LocalFontResult = {
  className: string;
  style: {
    fontFamily: string;
  };
  variable: string;
};

const buildFontFamily = (src: LocalFontSource) => {
  if (typeof src === "string") {
    return src.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? "local-font";
  }

  return src[0]?.path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? "local-font";
};

export default function localFont(options: LocalFontOptions): LocalFontResult {
  const fontFamily = buildFontFamily(options.src);

  return {
    className: options.variable ?? "",
    style: {
      fontFamily,
    },
    variable: options.variable ?? "",
  };
}
