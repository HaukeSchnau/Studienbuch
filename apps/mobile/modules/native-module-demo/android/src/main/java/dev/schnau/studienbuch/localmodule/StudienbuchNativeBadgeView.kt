package dev.schnau.studienbuch.localmodule

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class StudienbuchNativeBadgeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val label = TextView(context).also {
    it.gravity = Gravity.CENTER
    it.includeFontPadding = false
    it.setTypeface(Typeface.DEFAULT, Typeface.BOLD)
    it.textSize = 15f
    it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(it)
  }

  var title: String = "Native component"
    set(value) {
      field = value
      label.text = value
    }

  var accentColor: String = "#6DB868"
    set(value) {
      field = value
      updateAppearance()
    }

  init {
    label.text = title
    updateAppearance()
  }

  private fun updateAppearance() {
    val accent = runCatching { Color.parseColor(accentColor) }.getOrDefault(Color.rgb(109, 184, 104))
    val background = Color.argb(36, Color.red(accent), Color.green(accent), Color.blue(accent))
    this.background = GradientDrawable().apply {
      setColor(background)
      setStroke(dp(1), accent)
      cornerRadius = dp(14).toFloat()
    }
    label.setTextColor(accent)
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
