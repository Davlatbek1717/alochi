package uz.alojon.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Relaunches the kiosk after a (re)boot so a power-cycle can't be used
 * to land on the system launcher. MainActivity is also registered as
 * HOME, but starting it explicitly makes the transition immediate.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            val launch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launch)
        }
    }
}
