package expo.modules.applock

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Base64
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class AppLockModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AppLock")

    /** Launchable apps the user may lock (excludes Bookie, Settings, dialer, launcher). */
    AsyncFunction("getInstalledApps") {
      val pm = context.packageManager
      val excluded = neverLock()
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(launcher, 0)
        .distinctBy { it.activityInfo.packageName }
        .filter { it.activityInfo.packageName !in excluded }
        .map {
          mapOf(
            "packageName" to it.activityInfo.packageName,
            "label" to it.loadLabel(pm).toString(),
            "icon" to iconDataUri(it.loadIcon(pm)),
          )
        }
        .sortedBy { (it["label"] as String).lowercase() }
    }

    Function("isServiceEnabled") {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: ""
      val me = ComponentName(context, AppLockService::class.java)
      enabled.split(':').any {
        val c = ComponentName.unflattenFromString(it)
        c != null && c.packageName == me.packageName && c.className == me.className
      }
    }

    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    /** App info page, where "Allow restricted settings" lives on Android 13+. */
    Function("openAppSettings") {
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.fromParts("package", context.packageName, null))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("setConfig") { json: String ->
      LockPrefs.saveConfig(context, json)
    }

    Function("getCheatStats") {
      val history = LockPrefs.cheatHistory(context)
      val days = history.keys().asSequence().associateWith { history.optInt(it, 0) }
      mapOf(
        "today" to (days[LockPrefs.today()] ?: 0),
        "total" to days.values.sum(),
        "passesLeft" to LockPrefs.passesLeft(context),
        "history" to days,
      )
    }
  }

  private fun neverLock(): Set<String> {
    val pm = context.packageManager
    val set = mutableSetOf(context.packageName, "com.android.settings")
    pm.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
      ?.activityInfo?.packageName?.let { set.add(it) }
    try {
      (context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager)
        ?.defaultDialerPackage?.let { set.add(it) }
    } catch (_: Exception) {}
    return set
  }

  private fun iconDataUri(d: Drawable): String? = try {
    val size = 96
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    d.setBounds(0, 0, size, size)
    d.draw(Canvas(bmp))
    val out = ByteArrayOutputStream()
    bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
    "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  } catch (_: Exception) {
    null
  }
}
