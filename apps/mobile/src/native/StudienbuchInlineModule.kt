package dev.schnau.studienbuch.inline

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StudienbuchInlineModule : Module() {
  override fun definition() = ModuleDefinition {
    Constant("moduleKind") {
      "inline"
    }

    Function("getModuleBoundary") {
      "apps/mobile/src/native"
    }

    Function("getPlatformSummary") {
      "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) via Kotlin inline module"
    }
  }
}
