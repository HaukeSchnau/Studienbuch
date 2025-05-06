package de.haukeschnau.studienbuch.exponative

import android.annotation.SuppressLint
import android.content.Context
import android.view.MenuItem
import androidx.appcompat.widget.PopupMenu
import androidx.core.view.children
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

@SuppressLint("ViewConstructor")
class SelectView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onSelectItem by EventDispatcher()

  internal val popup = PopupMenu(context, this).apply {
    setOnMenuItemClickListener { menuItem: MenuItem ->
      val idx = this.menu.children.indexOf(menuItem)
      onSelectItem(mapOf("index" to idx))
      true
    }
  }
  init {
    setOnClickListener {
      popup.show()
    }
  }
}
