package uz.alojon.kiosk

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

/**
 * Blocks disallowed apps WITHOUT requiring device-owner provisioning.
 *
 * Device-owner `setPackagesSuspended` is the bulletproof path, but it needs
 * a factory-reset + ADB/QR enrollment. For tablets that are just installed
 * normally, this Accessibility Service is the standard fallback (the same
 * mechanism every no-root "app blocker / parental control" app uses):
 * it watches foreground-window changes and, when a blocked app comes to
 * the front, immediately sends the user back to the home screen.
 *
 * Requires a one-time manual enable in Settings → Accessibility (Android
 * security forbids auto-enabling an accessibility service without device
 * owner). Once enabled it keeps running in the background even when the
 * A'lojon app itself is closed.
 */
class AppBlockerAccessibilityService : AccessibilityService() {

    private var lastToastMs = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName) return
        if (!BlockedAppsManager.isBlockingEnabled(this)) return
        if (!BlockedAppsManager.BLOCKED_PACKAGES.contains(pkg)) return

        // Kick the user out of the blocked app.
        performGlobalAction(GLOBAL_ACTION_HOME)

        val now = System.currentTimeMillis()
        if (now - lastToastMs > 1500) {
            lastToastMs = now
            try {
                Toast.makeText(this, getString(R.string.app_blocked_toast), Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {}
        }
    }

    override fun onInterrupt() {}
}
