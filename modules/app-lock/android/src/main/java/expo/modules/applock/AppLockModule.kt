package expo.modules.applock

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
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

    /** Both are needed: usage access to see the app in front, overlay to cover it. */
    Function("getPermissions") {
      mapOf(
        "usageAccess" to AppLockService.hasUsageAccess(context),
        "overlay" to AppLockService.hasOverlay(context),
      )
    }

    Function("openUsageAccessSettings") {
      val pkgUri = Uri.fromParts("package", context.packageName, null)
      // Some OEMs support jumping straight to Bookie's entry; fall back to the list.
      val direct = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).setData(pkgUri)
      val intent = if (direct.resolveActivity(context.packageManager) != null) direct
        else Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("openOverlaySettings") {
      context.startActivity(
        Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.fromParts("package", context.packageName, null),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
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

    /**
     * True when Bookie was installed from outside the Play Store. Android 13+
     * hides the Usage access and Display-over-other-apps toggles behind
     * "Allow restricted settings" for such installs, so the UI needs to know
     * whether to explain that instead of just saying "turn it on".
     */
    Function("isSideloaded") { isSideloaded(context) }

    Function("setConfig") { json: String ->
      LockPrefs.saveConfig(context, json)
      AppLockService.sync(context)
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

  private fun isSideloaded(ctx: Context): Boolean {
    val pm = ctx.packageManager
    val installer = try {
      if (Build.VERSION.SDK_INT >= 30) {
        pm.getInstallSourceInfo(ctx.packageName).installingPackageName
      } else {
        @Suppress("DEPRECATION") pm.getInstallerPackageName(ctx.packageName)
      }
    } catch (_: Exception) {
      null
    }
    // A null installer means the APK was opened from a browser or Files app.
    return installer == null || installer !in TRUSTED_INSTALLERS
  }

  private companion object {
    /** Only the Play Store counts as a trusted source for restricted settings. */
    val TRUSTED_INSTALLERS = setOf("com.android.vending")
  }
}
