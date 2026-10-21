package expo.modules.applock

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Shared state between the JS bridge, the accessibility service and the
 * block screen. JS pushes the lock rules; passes/cheats live here so they
 * work even when the React app isn't running.
 */
object LockPrefs {
  const val PASSES_PER_DAY = 3
  const val PASS_MS = 5 * 60 * 1000L

  private const val FILE = "bookie_app_lock"
  private const val KEY_CONFIG = "config"
  private const val KEY_PASS_DATE = "pass_date"
  private const val KEY_PASS_USED = "pass_used"
  private const val KEY_PASS_UNTIL = "pass_until"
  private const val KEY_CHEATS = "cheat_history"

  data class LockedApp(val packageName: String, val label: String, val tier: Int)

  data class Config(
    val enabled: Boolean,
    val date: String,
    val pages: Int,
    val thresholds: List<Int>,
    val apps: Map<String, LockedApp>,
  )

  data class Block(val app: LockedApp, val tierNumber: Int, val pagesNeeded: Int)

  @Volatile private var cached: Config? = null

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  fun saveConfig(ctx: Context, json: String) {
    cached = parse(json)
    prefs(ctx).edit().putString(KEY_CONFIG, json).apply()
  }

  fun config(ctx: Context): Config =
    cached ?: parse(prefs(ctx).getString(KEY_CONFIG, null)).also { cached = it }

  private fun parse(json: String?): Config {
    val empty = Config(false, "", 0, emptyList(), emptyMap())
    if (json.isNullOrEmpty()) return empty
    return try {
      val o = JSONObject(json)
      val t = o.optJSONArray("thresholds")
      val thresholds = (0 until (t?.length() ?: 0)).map { t!!.getInt(it) }
      val a = o.optJSONArray("apps")
      val apps = (0 until (a?.length() ?: 0)).map {
        val app = a!!.getJSONObject(it)
        LockedApp(app.getString("packageName"), app.optString("label"), app.optInt("tier"))
      }.associateBy { it.packageName }
      Config(o.optBoolean("enabled"), o.optString("date"), o.optInt("pages"), thresholds, apps)
    } catch (e: Exception) {
      empty
    }
  }

  fun isLocked(ctx: Context, pkg: String): Boolean {
    val cfg = config(ctx)
    return cfg.enabled && cfg.thresholds.isNotEmpty() && cfg.apps.containsKey(pkg)
  }

  /** Non-null when `pkg` should be blocked right now. */
  fun block(ctx: Context, pkg: String): Block? {
    val cfg = config(ctx)
    if (!cfg.enabled || cfg.thresholds.isEmpty()) return null
    val app = cfg.apps[pkg] ?: return null
    // Midnight reset: stale progress from a previous day counts as 0.
    val pages = if (cfg.date == today()) cfg.pages else 0
    val tier = app.tier.coerceIn(0, cfg.thresholds.size - 1)
    val needed = cfg.thresholds[tier] - pages
    if (needed <= 0) return null
    if (passUntil(ctx, pkg) > System.currentTimeMillis()) return null
    return Block(app, tier + 1, needed)
  }

  fun passesUsedToday(ctx: Context): Int {
    val p = prefs(ctx)
    return if (p.getString(KEY_PASS_DATE, null) == today()) p.getInt(KEY_PASS_USED, 0) else 0
  }

  fun passesLeft(ctx: Context): Int = (PASSES_PER_DAY - passesUsedToday(ctx)).coerceAtLeast(0)

  fun passUntil(ctx: Context, pkg: String): Long = try {
    JSONObject(prefs(ctx).getString(KEY_PASS_UNTIL, "{}")!!).optLong(pkg, 0L)
  } catch (e: Exception) {
    0L
  }

  /** Spends one pass on `pkg`. Returns false when today's passes are used up. */
  @Synchronized
  fun usePass(ctx: Context, pkg: String): Boolean {
    val used = passesUsedToday(ctx)
    if (used >= PASSES_PER_DAY) return false
    val p = prefs(ctx)
    val now = System.currentTimeMillis()
    val until = try { JSONObject(p.getString(KEY_PASS_UNTIL, "{}")!!) } catch (e: Exception) { JSONObject() }
    // Drop expired entries so the map doesn't grow forever.
    until.keys().asSequence().toList().forEach { if (until.optLong(it) < now) until.remove(it) }
    until.put(pkg, now + PASS_MS)
    val cheats = cheatHistory(ctx)
    val day = today()
    cheats.put(day, cheats.optInt(day, 0) + 1)
    p.edit()
      .putString(KEY_PASS_DATE, day)
      .putInt(KEY_PASS_USED, used + 1)
      .putString(KEY_PASS_UNTIL, until.toString())
      .putString(KEY_CHEATS, cheats.toString())
      .apply()
    return true
  }

  fun cheatHistory(ctx: Context): JSONObject = try {
    JSONObject(prefs(ctx).getString(KEY_CHEATS, "{}")!!)
  } catch (e: Exception) {
    JSONObject()
  }
}
