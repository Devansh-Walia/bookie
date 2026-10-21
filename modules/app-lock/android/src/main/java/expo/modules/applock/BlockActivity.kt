package expo.modules.applock

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** Full-screen "read first" wall shown over a locked app. */
class BlockActivity : Activity() {
  private var pkg: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = BG
    window.navigationBarColor = BG
    render(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    render(intent)
  }

  override fun onResume() {
    super.onResume()
    // The user may have read enough (or the day rolled over) meanwhile.
    val p = pkg ?: return
    if (LockPrefs.block(this, p) == null) finish()
  }

  @Deprecated("Back always goes home so the locked app stays hidden.")
  override fun onBackPressed() = goHome()

  private fun render(intent: Intent) {
    val p = intent.getStringExtra(EXTRA_PKG)
    pkg = p
    val block = p?.let { LockPrefs.block(this, it) }
    if (p == null || block == null) {
      finish()
      return
    }
    val label = block.app.label.ifEmpty { appLabel(p) }
    val passesLeft = LockPrefs.passesLeft(this)
    val pageWord = if (block.pagesNeeded == 1) "page" else "pages"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(BG)
      setPadding(dp(32), dp(48), dp(32), dp(48))
    }

    try {
      root.addView(ImageView(this).apply {
        setImageDrawable(packageManager.getApplicationIcon(p))
        alpha = 0.5f
      }, LinearLayout.LayoutParams(dp(72), dp(72)).apply { bottomMargin = dp(20) })
    } catch (_: Exception) {}

    root.addView(text("📚  $label is locked", 24f, TEXT, bold = true))
    root.addView(text("TIER ${block.tierNumber}", 12f, PRIMARY_SOFT, bold = true).apply {
      letterSpacing = 0.15f
      setPadding(0, dp(10), 0, dp(6))
    })
    root.addView(
      text(
        "Read ${block.pagesNeeded} more $pageWord in Bookie to unlock it for the rest of today.",
        16f,
        MUTED,
      ).apply { setPadding(0, 0, 0, dp(32)) },
    )

    root.addView(button("Open Bookie", PRIMARY, Color.WHITE) {
      packageManager.getLaunchIntentForPackage(packageName)?.let {
        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(it)
      }
      finish()
    })

    val passMinutes = LockPrefs.PASS_MS / 60000
    val passLabel = if (passesLeft > 0) {
      "Cheat: $passMinutes-minute pass ($passesLeft left today)"
    } else {
      "No passes left today"
    }
    root.addView(button(passLabel, SURFACE, if (passesLeft > 0) TEXT else MUTED) {
      if (LockPrefs.usePass(this, p)) {
        packageManager.getLaunchIntentForPackage(p)?.let {
          it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          startActivity(it)
        }
        finish()
      }
    }.apply { isEnabled = passesLeft > 0 })

    root.addView(button("Go home", Color.TRANSPARENT, MUTED) { goHome() })

    setContentView(root)
  }

  private fun goHome() {
    startActivity(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
    finish()
  }

  private fun appLabel(p: String): String = try {
    packageManager.getApplicationLabel(packageManager.getApplicationInfo(p, 0)).toString()
  } catch (_: Exception) {
    p
  }

  private fun text(s: String, size: Float, color: Int, bold: Boolean = false) =
    TextView(this).apply {
      text = s
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      gravity = Gravity.CENTER
      if (bold) typeface = Typeface.DEFAULT_BOLD
    }

  private fun button(label: String, bg: Int, fg: Int, onClick: (View) -> Unit) =
    Button(this).apply {
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

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  companion object {
    const val EXTRA_PKG = "pkg"
    private val BG = Color.parseColor("#0F172A")
    private val SURFACE = Color.parseColor("#1E293B")
    private val TEXT = Color.parseColor("#F1F5F9")
    private val MUTED = Color.parseColor("#94A3B8")
    private val PRIMARY = Color.parseColor("#6366F1")
    private val PRIMARY_SOFT = Color.parseColor("#A5B4FC")

    fun show(ctx: Context, pkg: String) {
      ctx.startActivity(
        Intent(ctx, BlockActivity::class.java)
          .putExtra(EXTRA_PKG, pkg)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
      )
    }
  }
}
