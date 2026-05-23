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
import android.location.LocationListener
import android.location.LocationManager
import android.media.RingtoneManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.StatFs
import android.telephony.TelephonyManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
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
        private const val LOCATE_TIMEOUT_MS = 20_000L
        const val ACTION_UNBLOCK = "uz.alojon.kiosk.UNBLOCK"
        const val ACTION_FORCE_LOGOUT = "uz.alojon.kiosk.FORCE_LOGOUT"
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
            thread(name = "mdm-poll") { pollLoop() }
        }
        return START_STICKY
    }

    /**
     * Long-poll loop for near-instant command delivery (no FCM). Each request
     * blocks on the server up to ~25s; on return we run any commands and
     * immediately reconnect.
     */
    private fun pollLoop() {
        while (running) {
            try {
                if (!DeviceConfig.isConfigured(this)) {
                    Thread.sleep(10_000)
                    continue
                }
                val cmds = DeviceApi.pollCommands(this)
                if (cmds == null) {
                    Thread.sleep(5_000) // network error backoff
                } else {
                    for (cmd in cmds) handleCommand(cmd)
                }
            } catch (_: InterruptedException) {
                break
            } catch (e: Exception) {
                Log.w(TAG, "poll failed: ${e.message}")
                try { Thread.sleep(5_000) } catch (_: InterruptedException) { break }
            }
        }
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
        // Cache the central admin password (salt+hash) so the admin gesture
        // works offline with the org-wide password (#19).
        DeviceConfig.saveCentralAdmin(this, res.adminSalt, res.adminHash)
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

    private fun collectTelemetry(freshLocation: Location? = null): JSONObject {
        val o = JSONObject()
        o.put("batteryLevel", batteryPct())
        o.put("storageFreePct", storageFreePct())
        o.put("networkType", networkType())
        o.put("appVersion", appVersion())
        o.put("manufacturer", Build.MANUFACTURER)
        o.put("model", Build.MODEL)
        o.put("osVersion", Build.VERSION.RELEASE)
        AppBlockerAccessibilityService.currentPackage?.let { o.put("foregroundApp", it) }
        (freshLocation ?: lastLocation())?.let {
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

    /**
     * Actively acquires a fresh GPS fix (#29) instead of relying on a possibly
     * hours-old getLastKnownLocation — used when an admin requests LOCATE.
     * Requests a single update delivered on the main looper, waits up to
     * [timeoutMs] on this background thread, then removes the listener and
     * falls back to the last known location if no fresh fix arrived.
     */
    private fun requestFreshLocation(timeoutMs: Long): Location? {
        if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }
        val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return lastLocation()
        val provider = when {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ->
                LocationManager.NETWORK_PROVIDER
            else -> return lastLocation()
        }

        val latch = CountDownLatch(1)
        // No @Volatile needed: latch.countDown()/await() establish a
        // happens-before edge, so the read after await sees the write.
        var fresh: Location? = null
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                fresh = location
                latch.countDown()
            }

            // Empty overrides kept for pre-API-30 LocationListener compatibility.
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }

        return try {
            lm.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
            latch.await(timeoutMs, TimeUnit.MILLISECONDS)
            fresh ?: lastLocation()
        } catch (_: SecurityException) {
            lastLocation()
        } catch (_: Exception) {
            lastLocation()
        } finally {
            try { lm.removeUpdates(listener) } catch (_: Exception) {}
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
                    // Acquire a fresh fix rather than reporting a stale one.
                    val loc = requestFreshLocation(LOCATE_TIMEOUT_MS)
                    DeviceApi.heartbeat(this, collectTelemetry(loc))
                }
                "MESSAGE" -> showMessage(cmd.payload?.optString("text") ?: "")
                "RING" -> ringDevice()
                "FORCE_LOGOUT" -> forceLogout()
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

    private fun showMessage(text: String) {
        if (text.isBlank()) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            nm.getNotificationChannel("alojon_msg") == null
        ) {
            nm.createNotificationChannel(
                NotificationChannel(
                    "alojon_msg",
                    getString(R.string.app_name),
                    NotificationManager.IMPORTANCE_HIGH,
                ),
            )
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, "alojon_msg")
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }
        nm.notify(
            4712,
            builder
                .setContentTitle(getString(R.string.app_name))
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(text))
                .setSmallIcon(R.drawable.ic_launcher)
                .setAutoCancel(true)
                .build(),
        )
    }

    private fun ringDevice() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val rt = RingtoneManager.getRingtone(applicationContext, uri) ?: return
            rt.play()
            Handler(Looper.getMainLooper()).postDelayed({
                try { rt.stop() } catch (_: Exception) {}
            }, 15_000)
        } catch (_: Exception) {}
    }

    /**
     * Force-logout (#23): clear the WebView's auth cookies + DOM/localStorage
     * (where the web app keeps its JWT) so the next load lands on the login
     * screen, then broadcast so a foreground MainActivity reloads immediately.
     * If the activity isn't alive the cleared session already guarantees the
     * next launch starts logged-out. Non-destructive — no data wipe.
     */
    private fun forceLogout() {
        Handler(Looper.getMainLooper()).post {
            try {
                val cm = android.webkit.CookieManager.getInstance()
                cm.removeAllCookies(null)
                cm.flush()
                android.webkit.WebStorage.getInstance().deleteAllData()
            } catch (e: Exception) {
                Log.w(TAG, "clear session failed: ${e.message}")
            }
        }
        sendBroadcast(Intent(ACTION_FORCE_LOGOUT).setPackage(packageName))
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
