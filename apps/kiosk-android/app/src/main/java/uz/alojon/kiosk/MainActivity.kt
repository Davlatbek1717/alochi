package uz.alojon.kiosk

import android.app.Activity
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.Toast
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * The entire app: a hardened, full-screen WebView of the A'lojon web
 * app that the user cannot leave.
 *
 * Two layers of lockdown:
 *  1. App level — immersive UI, HOME/launcher role, back button pinned
 *     to in-WebView history, navigation fenced to the alojon.uz domain.
 *  2. OS level — when this app is *device owner*, Lock Task (kiosk)
 *     mode is entered, which the OS itself enforces (status bar,
 *     recents, other apps all blocked). Without device owner the app
 *     still runs but the OS guarantees are absent (see PROVISIONING.md).
 *  3. App blocking — browser, YouTube, and social media apps are
 *     suspended via DevicePolicyManager.setPackagesSuspended() whenever
 *     this activity is in the foreground. Unblocking requires the admin
 *     password (5 corner taps → password dialog).
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
        }
        setContentView(webView)
        enterImmersive()
        enforceKioskPolicies()
        BlockedAppsManager.applyBlocking(this)

        if (savedInstanceState == null) {
            webView.loadUrl(kioskUrl)
        }
    }

    /** Device-owner-only hardening + Lock Task entry. No-ops cleanly
     *  when the app is not device owner. */
    private fun enforceKioskPolicies() {
        val admin = KioskDeviceAdminReceiver.componentName(this)
        if (!dpm.isDeviceOwnerApp(packageName)) {
            startLockTaskSafely()
            return
        }

        dpm.setLockTaskPackages(admin, arrayOf(packageName))

        val filter = IntentFilter(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        dpm.addPersistentPreferredActivity(
            admin,
            filter,
            ComponentNameOf(this, MainActivity::class.java)
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            dpm.setKeyguardDisabled(admin, true)
            dpm.setStatusBarDisabled(admin, true)
        }
        startLockTaskSafely()
    }

    private fun startLockTaskSafely() {
        try {
            val am = getSystemService(Context.ACTIVITY_SERVICE)
                as android.app.ActivityManager
            @Suppress("DEPRECATION")
            val locked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.lockTaskModeState != android.app.ActivityManager.LOCK_TASK_MODE_NONE
            } else {
                am.isInLockTaskMode
            }
            if (!locked) startLockTask()
        } catch (_: Exception) {}
    }

    private fun enterImmersive() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    override fun onResume() {
        super.onResume()
        enterImmersive()
        startLockTaskSafely()
        // Re-block every time the kiosk comes to foreground (after admin
        // temporarily exits, or after any background stint).
        BlockedAppsManager.applyBlocking(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersive()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_HOME,
            KeyEvent.KEYCODE_APP_SWITCH,
            KeyEvent.KEYCODE_MENU -> true
            else -> super.onKeyDown(keyCode, event)
        }
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
        val options = buildList {
            add(getString(R.string.menu_unblock_apps))
            add(getString(R.string.menu_change_password))
            if (!isDeviceOwner) add(getString(R.string.menu_exit_kiosk))
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle(R.string.admin_menu_title)
            .setItems(options) { _, which ->
                val label = options[which]
                when (label) {
                    getString(R.string.menu_unblock_apps) -> temporarilyUnblock()
                    getString(R.string.menu_change_password) -> showSetPasswordDialog()
                    getString(R.string.menu_exit_kiosk) -> exitKiosk()
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun temporarilyUnblock() {
        BlockedAppsManager.removeBlocking(this)
        // Exit lock task so the admin can actually switch to other apps.
        try { stopLockTask() } catch (_: Exception) {}
        Toast.makeText(this, R.string.apps_unblocked_notice, Toast.LENGTH_LONG).show()
    }

    private fun exitKiosk() {
        try { stopLockTask() } catch (_: Exception) {}
        finishAndRemoveTask()
    }

    @Suppress("FunctionName")
    private fun ComponentNameOf(ctx: Context, cls: Class<out Activity>) =
        android.content.ComponentName(ctx.packageName, cls.name)

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
