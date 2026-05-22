package uz.alojon.kiosk

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.StatFs
import android.telephony.TelephonyManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import kotlin.concurrent.thread

/**
 * Foreground service that powers the MDM features:
 *  - every interval: collect telemetry (battery, storage, network, GPS,
 *    foreground app) and POST /device-api/heartbeat
 *  - apply the block state returned by the server (show/hide BlockActivity)
 *  - execute pending commands (BLOCK / UNBLOCK / LOCATE / REBOOT / WIPE)
 *
 * Only active once the device has been configured with an enrollment token.
 */
class DeviceMonitorService : Service() {

    companion object {
        private const val TAG = "DeviceMonitor"
        private const val CHANNEL_ID = "alojon_mdm"
        private const val NOTIF_ID = 4711
        private const val INTERVAL_MS = 60_000L
        const val ACTION_UNBLOCK = "uz.alojon.kiosk.UNBLOCK"
    }

    @Volatile private var running = false

    // Tamper de-dupe flags so we alert once per state change, not every tick.
    private var sentAccessibilityOff = false
    private var sentGpsOff = false
    private var sentSimAbsent = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // On Android 14+ a foreground service with type=location throws if the
        // location permission isn't granted yet. Fail soft: stop and let
        // MainActivity restart us once permissions are in place.
        try {
            startForeground(NOTIF_ID, buildNotification())
        } catch (e: Exception) {
            Log.w(TAG, "startForeground failed: ${e.message}")
            stopSelf()
            return START_NOT_STICKY
        }
        if (!running) {
            running = true
            thread(name = "mdm-loop") { loop() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }

    private fun loop() {
        while (running) {
            try {
                if (DeviceConfig.isConfigured(this)) tick()
            } catch (e: Exception) {
                Log.w(TAG, "tick failed: ${e.message}")
            }
            try {
                Thread.sleep(INTERVAL_MS)
            } catch (_: InterruptedException) {
                break
            }
        }
    }

    private fun tick() {
        val body = collectTelemetry()
        val res = DeviceApi.heartbeat(this, body) ?: return
        applyBlockState(res.blocked, res.blockReason)
        for (cmd in res.commands) handleCommand(cmd)
        checkTamper()
    }

    /**
     * Detect tamper / security conditions and report them once per state
     * change: accessibility blocker disabled, GPS off, SIM removed.
     */
    private fun checkTamper() {
        val events = JSONArray()
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        val isOwner = dpm?.isDeviceOwnerApp(packageName) == true

        // Blocking on but the accessibility blocker switched off (non-owner only).
        val accessibilityTampered = !isOwner &&
            BlockedAppsManager.isBlockingEnabled(this) &&
            !BlockedAppsManager.isAccessibilityServiceEnabled(this)
        if (accessibilityTampered) {
            if (!sentAccessibilityOff) {
                events.put(ev("accessibility_disabled", "warning"))
                sentAccessibilityOff = true
            }
        } else {
            sentAccessibilityOff = false
        }

        // Location services off.
        val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val gpsOn = lm?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
            lm?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
        if (!gpsOn) {
            if (!sentGpsOff) { events.put(ev("gps_off", "warning")); sentGpsOff = true }
        } else {
            sentGpsOff = false
        }

        // SIM removed.
        val tm = getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        val simAbsent = tm?.simState == TelephonyManager.SIM_STATE_ABSENT
        if (simAbsent) {
            if (!sentSimAbsent) { events.put(ev("sim_removed", "warning")); sentSimAbsent = true }
        } else {
            sentSimAbsent = false
        }

        if (events.length() > 0) DeviceApi.sendEvents(this, events)
    }

    private fun ev(type: String, severity: String): JSONObject =
        JSONObject().put("type", type).put("severity", severity)

    // ── Telemetry ─────────────────────────────────────────────────────────────

    private fun collectTelemetry(): JSONObject {
        val o = JSONObject()
        o.put("batteryLevel", batteryPct())
        o.put("storageFreePct", storageFreePct())
        o.put("networkType", networkType())
        o.put("appVersion", appVersion())
        o.put("manufacturer", Build.MANUFACTURER)
        o.put("model", Build.MODEL)
        o.put("osVersion", Build.VERSION.RELEASE)
        AppBlockerAccessibilityService.currentPackage?.let { o.put("foregroundApp", it) }
        lastLocation()?.let {
            o.put("latitude", it.latitude)
            o.put("longitude", it.longitude)
        }
        return o
    }

    private fun batteryPct(): Int {
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val viaMgr = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        if (viaMgr in 0..100) return viaMgr
        val intent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) (level * 100 / scale) else 0
    }

    private fun storageFreePct(): Int = try {
        val stat = StatFs(Environment.getDataDirectory().path)
        val free = stat.availableBytes.toDouble()
        val total = stat.totalBytes.toDouble()
        if (total > 0) ((free / total) * 100).toInt() else 0
    } catch (_: Exception) {
        0
    }

    private fun networkType(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "none"
        val net = cm.activeNetwork ?: return "none"
        val caps = cm.getNetworkCapabilities(net) ?: return "none"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "other"
        }
    }

    private fun appVersion(): String = try {
        packageManager.getPackageInfo(packageName, 0).versionName ?: "?"
    } catch (_: Exception) {
        "?"
    }

    private fun lastLocation(): Location? {
        if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }
        val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        return try {
            val providers = listOf(
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER,
            )
            providers.mapNotNull { p ->
                if (lm.isProviderEnabled(p)) lm.getLastKnownLocation(p) else null
            }.maxByOrNull { it.time }
        } catch (_: SecurityException) {
            null
        } catch (_: Exception) {
            null
        }
    }

    // ── Block state ─────────────────────────────────────────────────────────

    private fun applyBlockState(blocked: Boolean, reason: String?) {
        if (blocked) {
            if (!BlockActivity.isShowing) {
                val i = Intent(this, BlockActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    putExtra(BlockActivity.EXTRA_REASON, reason)
                }
                try { startActivity(i) } catch (_: Exception) {}
            }
        } else if (BlockActivity.isShowing) {
            sendBroadcast(Intent(ACTION_UNBLOCK).setPackage(packageName))
        }
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    private fun handleCommand(cmd: DeviceApi.Command) {
        var status = "completed"
        try {
            when (cmd.type.uppercase()) {
                "BLOCK" ->
                    applyBlockState(true, cmd.payload?.optString("reason"))
                "UNBLOCK" ->
                    applyBlockState(false, null)
                "LOCATE" -> {
                    val body = collectTelemetry()
                    DeviceApi.heartbeat(this, body)
                }
                "REBOOT" -> if (!deviceOwnerReboot()) status = "failed"
                "WIPE_USER_DATA", "FACTORY_RESET" -> if (!deviceOwnerWipe()) status = "failed"
                else -> status = "failed"
            }
        } catch (e: Exception) {
            Log.w(TAG, "command ${cmd.type} failed: ${e.message}")
            status = "failed"
        }
        if (cmd.id.isNotBlank()) DeviceApi.ackCommand(this, cmd.id, status)
    }

    private fun deviceOwnerReboot(): Boolean {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            ?: return false
        if (!dpm.isDeviceOwnerApp(packageName)) return false
        return try {
            dpm.reboot(KioskDeviceAdminReceiver.componentName(this))
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun deviceOwnerWipe(): Boolean {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
            ?: return false
        if (!dpm.isDeviceOwnerApp(packageName)) return false
        return try {
            dpm.wipeData(0)
            true
        } catch (_: Exception) {
            false
        }
    }

    // ── Foreground notification ────────────────────────────────────────────

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        getString(R.string.app_name),
                        NotificationManager.IMPORTANCE_MIN,
                    ),
                )
            }
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }
        return builder
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.mdm_running))
            .setSmallIcon(R.drawable.ic_launcher)
            .setOngoing(true)
            .build()
    }
}
