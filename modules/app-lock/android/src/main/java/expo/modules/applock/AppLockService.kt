package expo.modules.applock

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import android.util.Log

/**
 * Foreground service that watches which app is in front (via usage events)
 * and covers locked apps with [BlockOverlay].
 *
 * Speed: usage events are recorded the moment an activity resumes, so the
 * only lag is the poll interval. We poll every [FAST_POLL_MS] on the home
 * screen (where launches happen) and [POLL_MS] elsewhere, on a background
 * thread so Bookie's UI never stutters. Polling stops while the screen is off.
 */
class AppLockService : Service() {
  private lateinit var usm: UsageStatsManager
  private lateinit var worker: HandlerThread
  private lateinit var bg: Handler
  private val main = Handler(Looper.getMainLooper())
  private lateinit var overlay: BlockOverlay

  @Volatile private var foreground: String? = null
  private var lastEventTs = 0L
  private var lastRecheck = 0L
  private var launchers: Set<String> = emptySet()
  private var polling = false

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
      when (i.action) {
        Intent.ACTION_SCREEN_OFF -> stopPolling()
        Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT -> startPolling()
      }
    }
  }

  private val tick = object : Runnable {
    override fun run() {
      if (!polling) return
      poll()
      val fg = foreground
      bg.postDelayed(this, if (fg == null || fg in launchers) FAST_POLL_MS else POLL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    overlay = BlockOverlay(this)
    launchers = homePackages(this)
    worker = HandlerThread("AppLockPoll", Process.THREAD_PRIORITY_FOREGROUND).also { it.start() }
    bg = Handler(worker.looper)
    goForeground()
    registerReceiver(
      screenReceiver,
      IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_OFF)
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_USER_PRESENT)
      },
    )
    lastEventTs = System.currentTimeMillis() - 60_000
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    if (pm.isInteractive) startPolling()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Every startForegroundService() must be answered with startForeground().
    goForeground()
    if (!shouldRun(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    // Rules changed: re-evaluate whatever is on screen right now.
    bg.post { foreground?.let { evaluate(it) } }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    stopPolling()
    try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    worker.quitSafely()
    main.post { overlay.hide() }
    super.onDestroy()
  }

  private fun startPolling() {
    if (polling) return
    polling = true
    bg.removeCallbacks(tick)
    bg.post(tick)
  }

  private fun stopPolling() {
    polling = false
    bg.removeCallbacks(tick)
  }

  /** Runs on the worker thread. */
  private fun poll() {
    val now = System.currentTimeMillis()
    val newest = try {
      latestResumed(lastEventTs, now)
    } catch (e: Exception) {
      Log.w(TAG, "queryEvents failed", e)
      null
    }
    if (newest != null && newest != foreground) {
      foreground = newest
      lastRecheck = now
      evaluate(newest)
    } else if (now - lastRecheck > RECHECK_MS) {
      // Catches pass expiry and the midnight reset while an app stays open.
      lastRecheck = now
      foreground?.let { evaluate(it) }
    }
  }

  private fun latestResumed(from: Long, to: Long): String? {
    val events = usm.queryEvents(from, to)
    val e = UsageEvents.Event()
    var pkg: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      @Suppress("DEPRECATION")
      if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND && e.packageName !in IGNORED) {
        pkg = e.packageName
        lastEventTs = e.timeStamp
      }
    }
    return pkg
  }

  private fun evaluate(pkg: String) {
    Log.d(TAG, "foreground=$pkg")
    if (pkg in launchers) return // keep any wall up on top of home
    val block = if (pkg == packageName) null else LockPrefs.block(this, pkg)
    main.post {
      if (block != null) {
        if (overlay.showingFor != pkg) overlay.show(pkg, block)
        // Push the locked app behind home so it pauses (stops video/audio).
        goHome(this)
      } else if (overlay.isShowing) {
        overlay.hide()
      }
    }
  }

  private fun goForeground() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "App Lock", NotificationManager.IMPORTANCE_MIN).apply {
          setShowBadge(false)
        },
      )
    }
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }
    val n = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else
      @Suppress("DEPRECATION") Notification.Builder(this))
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setContentTitle("App Lock is on")
      .setContentText("Read in Bookie to unlock your apps.")
      .setContentIntent(open)
      .setOngoing(true)
      .build()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIF_ID, n)
    }
  }

  companion object {
    private const val TAG = "AppLock"
    private const val CHANNEL = "app_lock"
    private const val NOTIF_ID = 4201
    private const val FAST_POLL_MS = 80L
    private const val POLL_MS = 250L
    private const val RECHECK_MS = 1000L

    /** Windows that never count as "the app in front". */
    private val IGNORED = setOf("com.android.systemui", "android")

    fun hasUsageAccess(ctx: Context): Boolean {
      val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= 29) {
        ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
      } else {
        @Suppress("DEPRECATION")
        ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
      }
      return if (mode == AppOpsManager.MODE_DEFAULT) {
        ctx.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
          android.content.pm.PackageManager.PERMISSION_GRANTED
      } else {
        mode == AppOpsManager.MODE_ALLOWED
      }
    }

    fun hasOverlay(ctx: Context): Boolean =
      Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx)

    fun shouldRun(ctx: Context): Boolean {
      val cfg = LockPrefs.config(ctx)
      return cfg.enabled && cfg.apps.isNotEmpty() && cfg.thresholds.isNotEmpty() &&
        hasUsageAccess(ctx) && hasOverlay(ctx)
    }

    /** Starts, refreshes or stops the service to match the saved rules + permissions. */
    fun sync(ctx: Context) {
      val app = ctx.applicationContext
      val intent = Intent(app, AppLockService::class.java)
      if (shouldRun(app)) {
        try {
          if (Build.VERSION.SDK_INT >= 26) app.startForegroundService(intent) else app.startService(intent)
        } catch (_: Exception) {
          // Background start not allowed right now; next sync (app resume / boot) retries.
        }
      } else {
        app.stopService(intent)
      }
    }

    fun homePackages(ctx: Context): Set<String> {
      val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
      return ctx.packageManager.queryIntentActivities(home, 0)
        .map { it.activityInfo.packageName }
        .toSet()
    }

    fun goHome(ctx: Context) {
      ctx.startActivity(
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AppLockService.sync(context)
  }
}
