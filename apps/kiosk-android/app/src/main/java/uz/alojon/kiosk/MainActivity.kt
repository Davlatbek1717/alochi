package uz.alojon.kiosk

import android.Manifest
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.EditText
import android.widget.Toast
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Full-screen WebView of the A'lojon web app. NOT a locked kiosk — the
 * student can leave the app freely (Home/Back/Recents all work) so the
 * tablet's phone, SMS and other system apps stay usable.
 *
 * The lockdown is limited to APP BLOCKING: browsers, YouTube and social
 * media are blocked system-wide so that leaving A'lojon is harmless.
 * Blocking works two ways:
 *  - device owner → DevicePolicyManager.setPackagesSuspended() (bulletproof)
 *  - plain install → AppBlockerAccessibilityService bounces the user out of
 *    blocked apps (needs a one-time accessibility enable).
 * Admin (5 corner taps → password) can toggle blocking and change the
 * password. Navigation inside the WebView is fenced to the alojon.uz domain.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var dpm: DevicePolicyManager

    private val kioskUrl: String by lazy { getString(R.string.kiosk_url) }
    private val allowedHost: String by lazy {
        Uri.parse(kioskUrl).host ?: "alojon.uz"
    }

    // Secret gesture: 5 taps in the top-right corner within 3 s → admin menu.
    private var cornerTapCount = 0
    private var lastCornerTapMs = 0L
    private val CORNER_DP = 80
    private val EXIT_TAPS = 5
    private val EXIT_WINDOW_MS = 3_000L
    private val REQ_MEDIA_PERMS = 1001

    // "Enable accessibility" nudge dialog (non-device-owner blocking).
    private var accDialog: AlertDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this).apply {
            with(settings) {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                useWideViewPort = true
                loadWithOverviewMode = true
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val host = request.url.host ?: return true
                    val ok = host == allowedHost || host.endsWith(".$allowedHost")
                    return !ok
                }
            }
            // Grant the in-app web page (alojon.uz) access to the camera and
            // microphone so the daily check-in video records inside the kiosk
            // without any prompt. The OS-level runtime permissions are granted
            // separately (auto-granted when device owner; requested otherwise).
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread { request.grant(request.resources) }
                }
            }
        }
        setContentView(webView)
        BlockedAppsManager.applyBlocking(this)
        ensureMediaPermissions()

        if (savedInstanceState == null) {
            webView.loadUrl(kioskUrl)
        }
    }

    /**
     * Make sure CAMERA + RECORD_AUDIO are granted at the OS level so the
     * in-app check-in video recorder works with no prompt. When the app is
     * device owner we silently auto-grant (production tablets); otherwise we
     * fall back to a normal runtime request (sideloaded test installs).
     */
    private fun ensureMediaPermissions() {
        val perms = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        if (dpm.isDeviceOwnerApp(packageName)) {
            val admin = KioskDeviceAdminReceiver.componentName(this)
            perms.forEach { perm ->
                try {
                    dpm.setPermissionGrantState(
                        admin,
                        packageName,
                        perm,
                        DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
                    )
                } catch (_: Exception) {}
            }
            return
        }
        val missing = perms.filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            try {
                requestPermissions(missing.toTypedArray(), REQ_MEDIA_PERMS)
            } catch (_: Exception) {}
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-assert blocking every time A'lojon comes to the foreground.
        BlockedAppsManager.applyBlocking(this)
        maybePromptAccessibility()
    }

    /**
     * On non-device-owner tablets, blocking relies on the accessibility
     * service, which the OS won't let us enable automatically. Nudge the
     * admin to turn it on once; the dialog disappears as soon as it's on.
     */
    private fun maybePromptAccessibility() {
        if (dpm.isDeviceOwnerApp(packageName)) return
        if (!BlockedAppsManager.isBlockingEnabled(this)) return
        if (BlockedAppsManager.isAccessibilityServiceEnabled(this)) {
            accDialog?.dismiss()
            accDialog = null
            return
        }
        if (accDialog?.isShowing == true) return
        accDialog = AlertDialog.Builder(this)
            .setTitle(R.string.enable_blocking_title)
            .setMessage(R.string.enable_blocking_message)
            .setPositiveButton(R.string.enable_blocking_open) { _, _ ->
                try {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                } catch (_: Exception) {}
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Back navigates the web history; once at the start, let the OS
        // handle it (so the student can leave the app freely).
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.action == MotionEvent.ACTION_DOWN) {
            val cornerPx = (CORNER_DP * resources.displayMetrics.density).toInt()
            val decorWidth = window.decorView.width
            if (ev.rawX > decorWidth - cornerPx && ev.rawY < cornerPx) {
                val now = System.currentTimeMillis()
                if (now - lastCornerTapMs > EXIT_WINDOW_MS) cornerTapCount = 0
                lastCornerTapMs = now
                if (++cornerTapCount >= EXIT_TAPS) {
                    showAdminPrompt()
                    cornerTapCount = 0
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    // ─── Admin unlock flow ────────────────────────────────────────────────

    private fun showAdminPrompt() {
        if (!AdminAuth.isPasswordSet(this)) {
            showSetPasswordDialog()
            return
        }
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            hint = getString(R.string.admin_password_hint)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.admin_login_title)
            .setView(input)
            .setPositiveButton(R.string.ok) { _, _ ->
                if (AdminAuth.checkPassword(this, input.text.toString())) {
                    showAdminMenu()
                } else {
                    Toast.makeText(this, R.string.wrong_password, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showSetPasswordDialog() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            hint = getString(R.string.set_password_hint)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.set_password_title)
            .setMessage(R.string.set_password_message)
            .setView(input)
            .setPositiveButton(R.string.ok) { _, _ ->
                val pw = input.text.toString().trim()
                if (pw.length >= 4) {
                    AdminAuth.setPassword(this, pw)
                    Toast.makeText(this, R.string.password_set, Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, R.string.password_too_short, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showAdminMenu() {
        val isDeviceOwner = dpm.isDeviceOwnerApp(packageName)
        val blockingOn = BlockedAppsManager.isBlockingEnabled(this)
        val toggleLabel = getString(
            if (blockingOn) R.string.menu_disable_blocking else R.string.menu_enable_blocking,
        )
        val options = buildList {
            add(toggleLabel)
            add(getString(R.string.menu_change_password))
            if (!isDeviceOwner) add(getString(R.string.menu_exit_kiosk))
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle(R.string.admin_menu_title)
            .setItems(options) { _, which ->
                when (options[which]) {
                    toggleLabel -> if (blockingOn) disableBlocking() else enableBlocking()
                    getString(R.string.menu_change_password) -> showSetPasswordDialog()
                    getString(R.string.menu_exit_kiosk) -> exitKiosk()
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun disableBlocking() {
        BlockedAppsManager.setBlockingEnabled(this, false)
        BlockedAppsManager.removeBlocking(this) // unsuspend if device owner
        Toast.makeText(this, R.string.blocking_disabled_toast, Toast.LENGTH_LONG).show()
    }

    private fun enableBlocking() {
        BlockedAppsManager.setBlockingEnabled(this, true)
        BlockedAppsManager.applyBlocking(this)
        Toast.makeText(this, R.string.blocking_enabled_toast, Toast.LENGTH_SHORT).show()
    }

    private fun exitKiosk() {
        finishAndRemoveTask()
    }

    override fun onDestroy() {
        try {
            webView.stopLoading()
            webView.destroy()
        } catch (_: Exception) {}
        super.onDestroy()
    }

    @Suppress("unused")
    private fun hasInternetPermission(): Boolean =
        checkSelfPermission(android.Manifest.permission.INTERNET) ==
            PackageManager.PERMISSION_GRANTED
}
