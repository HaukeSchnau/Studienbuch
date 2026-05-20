internal import ExpoModulesCore
import UIKit

class StudienbuchInlineModule: Module {
  public func definition() -> ModuleDefinition {
    Constant("moduleKind") {
      "inline"
    }

    Function("getModuleBoundary") { () -> String in
      "apps/mobile/src/native"
    }

    Function("getPlatformSummary") { () -> String in
      let device = UIDevice.current
      return "\(device.systemName) \(device.systemVersion) via Swift inline module"
    }
  }
}
