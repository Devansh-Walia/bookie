package expo.modules.applock

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent

/**
 * Watches which app comes to the foreground and puts the block screen over
 * locked apps. Only listens to window-state changes; never reads content.
 */
class AppLockService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var foregroundPkg: String? = null
  private var lastBlockPkg: String? = null
  private var lastBlockAt = 0L

  private val recheck = Runnable { foregroundPkg?.let { check(it) } }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg in IGNORED || pkg == currentInputMethod()) return

    foregroundPkg = pkg
    if (pkg == packageName) {
      // Bookie itself (or our block screen) is in front.
      handler.removeCallbacks(recheck)
      return
    }
    check(pkg)
  }

  private fun check(pkg: String) {
    handler.removeCallbacks(recheck)
    val block = LockPrefs.block(this, pkg)
    if (block != null) {
      val now = SystemClock.elapsedRealtime()
      // A single app launch fires several events; don't relaunch in a loop.
      if (pkg == lastBlockPkg && now - lastBlockAt < 800) return
      lastBlockPkg = pkg
      lastBlockAt = now
      BlockActivity.show(this, pkg)
      return
    }
    // On a pass: come back when it runs out in case the app is still open.
    if (LockPrefs.isLocked(this, pkg)) {
      val remaining = LockPrefs.passUntil(this, pkg) - System.currentTimeMillis()
      if (remaining > 0) handler.postDelayed(recheck, remaining + 500)
    }
  }

  private fun currentInputMethod(): String? =
    Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
      ?.substringBefore('/')

  override fun onInterrupt() {}

  override fun onDestroy() {
    handler.removeCallbacks(recheck)
    super.onDestroy()
  }

  companion object {
    /** Overlays that sit on top of apps and must not count as "foreground". */
    private val IGNORED = setOf("com.android.systemui", "android")
  }
}
