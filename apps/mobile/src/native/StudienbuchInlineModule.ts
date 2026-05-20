import { NativeModule, requireNativeModule } from "expo";

declare class StudienbuchInlineModule extends NativeModule {
  moduleKind: "inline";
  getModuleBoundary(): string;
  getPlatformSummary(): string;
}

export default requireNativeModule<StudienbuchInlineModule>("StudienbuchInlineModule");
