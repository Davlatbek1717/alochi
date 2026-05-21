package uz.alojon.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Catches newly installed packages and immediately suspends any that are
 * on the blocked list. Prevents students from sideloading blocked apps.
 */
class AppInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_PACKAGE_ADDED) return
        val pkg = intent.data?.schemeSpecificPart ?: return
        if (intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) return
        BlockedAppsManager.suspendIfBlocked(context, pkg)
    }
}
