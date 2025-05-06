package de.haukeschnau.studienbuch.exponative

import android.content.Context
import android.graphics.*
import android.view.MotionEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class DrawingExpoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val paint = Paint().apply {
        color = Color.BLACK
        style = Paint.Style.STROKE
        strokeWidth = 5f
        isAntiAlias = true
    }

    private val path = Path()
    private val svgPathBuilder = StringBuilder()
    private var lastX = 0f
    private var lastY = 0f
    private var isPathStarted = false

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawPath(path, paint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                path.moveTo(x, y)
                svgPathBuilder.append("M $x $y ")
                lastX = x
                lastY = y
                isPathStarted = true
                invalidate()
            }
            MotionEvent.ACTION_MOVE -> {
                val midX = (lastX + x) / 2
                val midY = (lastY + y) / 2
                path.quadTo(lastX, lastY, midX, midY)
                svgPathBuilder.append("Q $lastX $lastY $midX $midY ")
                lastX = x
                lastY = y
                invalidate()
            }
            MotionEvent.ACTION_UP -> {
                isPathStarted = false
            }
        }
        return true
    }

    /**
     * Returns the SVG path data representing the drawing.
     */
    fun getSVG(): String {
        val width = width
        val height = height
        val pathData = svgPathBuilder.trim()
        return """
            <svg xmlns="http://www.w3.org/2000/svg" width="$width" height="$height" viewBox="0 0 $width $height">
                <path d="$pathData" fill="none" stroke="black" stroke-width="5"/>
            </svg>
        """.trimIndent()
    }
}
