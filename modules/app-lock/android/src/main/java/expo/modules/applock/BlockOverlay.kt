package expo.modules.applock

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen "read first" wall drawn as an overlay window. Adding a window
 * takes one frame, much faster than launching an activity.
 * Main thread only.
 */
class BlockOverlay(private val ctx: Context) {
  private val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: FrameLayout? = null

  var showingFor: String? = null
    private set

  val isShowing: Boolean get() = root != null

  fun show(pkg: String, block: LockPrefs.Block) {
    val content = build(pkg, block)
    val r = root
    if (r != null) {
      r.removeAllViews()
      r.addView(content)
    } else {
      val frame = object : FrameLayout(ctx) {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
          if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) goHome()
            return true
          }
          return super.dispatchKeyEvent(event)
        }
      }.apply {
        setBackgroundColor(BG)
        isFocusableInTouchMode = true
        addView(content)
      }
      try {
        wm.addView(frame, params())
        frame.requestFocus()
        root = frame
      } catch (e: Exception) {
        Log.w("AppLock", "addView failed", e)
        // Overlay permission revoked; the service stops on the next sync.
        return
      }
    }
    showingFor = pkg
  }

  fun hide() {
    root?.let { try { wm.removeViewImmediate(it) } catch (_: Exception) {} }
    root = null
    showingFor = null
  }

  private fun goHome() {
    hide()
    AppLockService.goHome(ctx)
  }

  private fun launch(pkg: String) {
    ctx.packageManager.getLaunchIntentForPackage(pkg)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(it)
    }
  }

  @Suppress("DEPRECATION")
  private fun params() = WindowManager.LayoutParams(
    WindowManager.LayoutParams.MATCH_PARENT,
    WindowManager.LayoutParams.MATCH_PARENT,
    if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else WindowManager.LayoutParams.TYPE_PHONE,
    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
    PixelFormat.OPAQUE,
  ).apply { gravity = Gravity.CENTER }

  private fun build(pkg: String, block: LockPrefs.Block): View {
    val pm = ctx.packageManager
    val label = block.app.label.ifEmpty { appLabel(pkg) }
    val passesLeft = LockPrefs.passesLeft(ctx)
    val pageWord = if (block.pagesNeeded == 1) "page" else "pages"

    val col = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(32), dp(48), dp(32), dp(48))
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      )
    }

    try {
      col.addView(ImageView(ctx).apply {
        setImageDrawable(pm.getApplicationIcon(pkg))
        alpha = 0.5f
      }, LinearLayout.LayoutParams(dp(72), dp(72)).apply { bottomMargin = dp(20) })
    } catch (_: Exception) {}

    col.addView(text("📚  $label is locked", 24f, TEXT, bold = true))
    col.addView(text("TIER ${block.tierNumber}", 12f, PRIMARY_SOFT, bold = true).apply {
      letterSpacing = 0.15f
      setPadding(0, dp(10), 0, dp(6))
    })
    col.addView(
      text(
        "Read ${block.pagesNeeded} more $pageWord in Bookie to unlock it for the rest of today.",
        16f,
        MUTED,
      ).apply { setPadding(0, 0, 0, dp(32)) },
    )

    col.addView(button("Open Bookie", PRIMARY, Color.WHITE) {
      hide()
      launch(ctx.packageName)
    })

    val passMinutes = LockPrefs.PASS_MS / 60000
    val passLabel = if (passesLeft > 0) {
      "Cheat: $passMinutes-minute pass ($passesLeft left today)"
    } else {
      "No passes left today"
    }
    col.addView(button(passLabel, SURFACE, if (passesLeft > 0) TEXT else MUTED) {
      if (LockPrefs.usePass(ctx, pkg)) {
        hide()
        launch(pkg)
      }
    }.apply { isEnabled = passesLeft > 0 })

    col.addView(button("Go home", Color.TRANSPARENT, MUTED) { goHome() })
    return col
  }

  private fun appLabel(p: String): String = try {
    val pm = ctx.packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(p, 0)).toString()
  } catch (_: Exception) {
    p
  }

  private fun text(s: String, size: Float, color: Int, bold: Boolean = false) =
    TextView(ctx).apply {
      text = s
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      gravity = Gravity.CENTER
      if (bold) typeface = Typeface.DEFAULT_BOLD
    }

  private fun button(label: String, bg: Int, fg: Int, onClick: (View) -> Unit) =
    Button(ctx).apply {
      text = label
      isAllCaps = false
      setTextColor(fg)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      typeface = Typeface.DEFAULT_BOLD
      stateListAnimator = null
      background = GradientDrawable().apply {
        setColor(bg)
        cornerRadius = dp(14).toFloat()
      }
      setOnClickListener(onClick)
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(54),
      ).apply { bottomMargin = dp(12) }
    }

  private fun dp(v: Int) = (v * ctx.resources.displayMetrics.density).toInt()

  companion object {
    private val BG = Color.parseColor("#0F172A")
    private val SURFACE = Color.parseColor("#1E293B")
    private val TEXT = Color.parseColor("#F1F5F9")
    private val MUTED = Color.parseColor("#94A3B8")
    private val PRIMARY = Color.parseColor("#6366F1")
    private val PRIMARY_SOFT = Color.parseColor("#A5B4FC")
  }
}
