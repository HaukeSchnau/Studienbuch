package dev.schnau.studienbuch.localmodule

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StudienbuchLocalModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StudienbuchLocalModule")

    Constant("moduleKind") {
      "local"
    }

    Function("getModuleBoundary") {
      "apps/mobile/modules/native-module-demo"
    }

    Function("getPlatformSummary") {
      "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) via Kotlin local Expo module"
    }
  }
}
