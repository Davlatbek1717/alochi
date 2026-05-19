package uz.alojon.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context

/**
 * Device-admin / device-owner component. Being *device owner* (set once
 * at provisioning time — see PROVISIONING.md) is the privilege that lets
 * the app call DevicePolicyManager.setLockTaskPackages(...) and enter
 * unbypassable Lock Task (kiosk) mode.
 */
class KioskDeviceAdminReceiver : DeviceAdminReceiver() {
    companion object {
        fun componentName(context: Context): ComponentName =
            ComponentName(context.applicationContext, KioskDeviceAdminReceiver::class.java)
    }
}
