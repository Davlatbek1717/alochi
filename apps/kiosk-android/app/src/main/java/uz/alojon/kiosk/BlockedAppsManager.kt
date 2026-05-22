package uz.alojon.kiosk

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.app.admin.DevicePolicyManager

object BlockedAppsManager {

    private const val TAG = "BlockedAppsManager"

    private const val PREFS = "kiosk_blocking"
    private const val KEY_ENABLED = "blocking_enabled"

    /** Master on/off switch (default ON). The accessibility blocker and the
     *  device-owner suspension both honour this flag, so the admin can
     *  temporarily lift blocking from one place. */
    fun isBlockingEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, true)

    fun setBlockingEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    /** True when our AppBlockerAccessibilityService is enabled in system
     *  settings (the non-device-owner blocking path). */
    fun isAccessibilityServiceEnabled(context: Context): Boolean {
        val expected = "${context.packageName}/${AppBlockerAccessibilityService::class.java.name}"
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false
        return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
    }

    // Browsers and web engines
    private val BROWSERS = setOf(
        "com.android.chrome",
        "com.google.android.browser",
        "org.mozilla.firefox",
        "org.mozilla.firefox_beta",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.opera.mini.native.beta",
        "com.brave.browser",
        "com.brave.browser_beta",
        "com.microsoft.emmx",
        "com.sec.android.app.sbrowser",
        "com.UCMobile.intl",
        "com.uc.browser.en",
        "com.android.browser",
        "org.chromium.chrome",
        "com.kiwibrowser.browser",
        "com.vivaldi.browser",
        "com.duckduckgo.mobile.android",
        "anar.apps.yandexbrowser",
        "com.yandex.browser",
    )

    // Google apps with internet/social exposure
    private val GOOGLE_APPS = setOf(
        "com.google.android.googlequicksearchbox",
        "com.google.android.youtube",
        "com.google.android.apps.youtube.music",
        "com.google.android.apps.youtube.kids",
    )

    // Social media and messaging
    private val SOCIAL = setOf(
        "com.facebook.katana",
        "com.facebook.lite",
        "com.facebook.orca",
        "com.instagram.android",
        "com.whatsapp",
        "com.whatsapp.w4b",
        "com.twitter.android",
        "com.twitter.android.lite",
        "com.snapchat.android",
        "com.vkontakte.android",
        "ru.ok.android",
        "com.tiktok.musically",
        "com.zhiliaoapp.musically",
        "com.telegram.messenger",
        "org.telegram.messenger",
        "org.telegram.messenger.web",
        "com.discord",
        "kik.android",
        "com.skype.raider",
        "com.viber.voip",
        "com.imo.android.imoim",
        "com.linkedin.android",
        "com.pinterest",
        "com.tumblr",
    )

    val BLOCKED_PACKAGES: Set<String> = BROWSERS + GOOGLE_APPS + SOCIAL

    fun applyBlocking(context: Context) {
        if (!isBlockingEnabled(context)) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            // Non-device-owner: the AppBlockerAccessibilityService handles
            // blocking instead (once the admin has enabled it in Settings).
            Log.i(TAG, "Not device owner — relying on accessibility blocker")
            return
        }
        val admin = KioskDeviceAdminReceiver.componentName(context)
        val candidates = BLOCKED_PACKAGES
            .filter { it != context.packageName && isInstalled(context, it) }
            .toTypedArray()
        if (candidates.isEmpty()) return
        try {
            val failed = dpm.setPackagesSuspended(admin, candidates, true)
            val count = candidates.size - (failed?.size ?: 0)
            Log.i(TAG, "Blocked $count packages")
        } catch (e: Exception) {
            Log.e(TAG, "applyBlocking failed", e)
        }
    }

    fun removeBlocking(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(context.packageName)) return
        val admin = KioskDeviceAdminReceiver.componentName(context)
        val candidates = BLOCKED_PACKAGES
            .filter { it != context.packageName && isInstalled(context, it) }
            .toTypedArray()
        if (candidates.isEmpty()) return
        try {
            dpm.setPackagesSuspended(admin, candidates, false)
            Log.i(TAG, "Unblocked all packages")
        } catch (e: Exception) {
            Log.e(TAG, "removeBlocking failed", e)
        }
    }

    fun suspendIfBlocked(context: Context, packageName: String) {
        if (!BLOCKED_PACKAGES.contains(packageName)) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(context.packageName)) return
        val admin = KioskDeviceAdminReceiver.componentName(context)
        try {
            dpm.setPackagesSuspended(admin, arrayOf(packageName), true)
            Log.i(TAG, "Suspended newly installed: $packageName")
        } catch (e: Exception) {
            Log.e(TAG, "suspendIfBlocked failed for $packageName", e)
        }
    }

    private fun isInstalled(context: Context, pkg: String): Boolean = try {
        context.packageManager.getPackageInfo(pkg, 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }
}
