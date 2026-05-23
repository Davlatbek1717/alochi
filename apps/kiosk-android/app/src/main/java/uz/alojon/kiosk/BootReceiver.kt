package uz.alojon.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Relaunches the kiosk after a (re)boot so a power-cycle can't be used
 * to land on the system launcher. MainActivity is also registered as
 * HOME, but starting it explicitly makes the transition immediate.
 *
 * It also (re)starts DeviceMonitorService directly (#22) so MDM telemetry,
 * command polling and block enforcement resume after a reboot even if the
 * student never opens the app — previously the service only started from
 * MainActivity.onCreate, leaving a freshly-rebooted-but-untouched tablet
 * invisible to the admin panel.
 */
class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            // Start the monitor service first so it survives even if launching
            // the activity is throttled by the OS on a cold boot.
            if (DeviceConfig.isConfigured(context)) {
                try {
                    val svc = Intent(context, DeviceMonitorService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(svc)
                    } else {
                        context.startService(svc)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "startService on boot failed: ${e.message}")
                }
            }

            val launch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                context.startActivity(launch)
            } catch (e: Exception) {
                Log.w(TAG, "startActivity on boot failed: ${e.message}")
            }
        }
    }
}
