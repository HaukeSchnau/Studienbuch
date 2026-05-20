import { NativeModule, requireNativeModule } from "expo";

declare class StudienbuchLocalModule extends NativeModule {
  moduleKind: "local";
  getModuleBoundary(): string;
  getPlatformSummary(): string;
}

export default requireNativeModule<StudienbuchLocalModule>("StudienbuchLocalModule");
