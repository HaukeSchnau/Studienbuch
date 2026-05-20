import ExpoModulesCore
import UIKit

public class StudienbuchLocalModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StudienbuchLocalModule")

    Constant("moduleKind") {
      "local"
    }

    Function("getModuleBoundary") { () -> String in
      "apps/mobile/modules/native-module-demo"
    }

    Function("getPlatformSummary") { () -> String in
      let device = UIDevice.current
      return "\(device.systemName) \(device.systemVersion) via Swift local Expo module"
    }
  }
}
