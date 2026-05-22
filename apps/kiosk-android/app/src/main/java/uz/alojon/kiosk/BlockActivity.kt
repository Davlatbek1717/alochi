package uz.alojon.kiosk

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen lock shown when the device is remotely blocked by an admin.
 * Plain programmatic UI (no layout XML) to keep the kiosk module tiny.
 * The Back button is swallowed; on device-owner devices the monitor service
 * also pins it with Lock Task so it can't be escaped.
 */
class BlockActivity : Activity() {

    companion object {
        const val EXTRA_REASON = "reason"
        @Volatile var isShowing = false
    }

    private val unblockReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) {
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val filter = IntentFilter(DeviceMonitorService.ACTION_UNBLOCK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(unblockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(unblockReceiver, filter)
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
        )

        val reason = intent.getStringExtra(EXTRA_REASON)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0f172a"))
            setPadding(64, 64, 64, 64)
        }
        root.addView(TextView(this).apply {
            text = "🔒"
            textSize = 64f
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = getString(R.string.blocked_title)
            setTextColor(Color.WHITE)
            textSize = 24f
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 12)
        })
        root.addView(TextView(this).apply {
            text = if (reason.isNullOrBlank()) getString(R.string.blocked_body) else reason
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 16f
            gravity = Gravity.CENTER
        })
        setContentView(root)
        hideSystemUi()
    }

    override fun onResume() {
        super.onResume()
        isShowing = true
        hideSystemUi()
    }

    override fun onPause() {
        super.onPause()
        isShowing = false
    }

    override fun onDestroy() {
        try { unregisterReceiver(unblockReceiver) } catch (_: Exception) {}
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Swallow — cannot leave the lock with Back.
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            )
    }
}
