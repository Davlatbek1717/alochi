package uz.alojon.kiosk

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
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
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var dpm: DevicePolicyManager

    private val kioskUrl: String by lazy { getString(R.string.kiosk_url) }
    private val allowedHost: String by lazy {
        Uri.parse(kioskUrl).host ?: "alojon.uz"
    }

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
                    // Fence navigation to the kiosk domain (and its
                    // subdomains). Anything else is refused so a crafted
                    // link can't open a browser / escape the kiosk.
                    val ok = host == allowedHost ||
                        host.endsWith(".$allowedHost")
                    return !ok // true = we handled it (i.e. blocked)
                }
            }
        }
        setContentView(webView)
        enterImmersive()
        enforceKioskPolicies()

        if (savedInstanceState == null) {
            webView.loadUrl(kioskUrl)
        }
    }

    /** Device-owner-only hardening + Lock Task entry. No-ops cleanly
     *  when the app is not device owner. */
    private fun enforceKioskPolicies() {
        val admin = KioskDeviceAdminReceiver.componentName(this)
        if (!dpm.isDeviceOwnerApp(packageName)) {
            // Still try plain screen-pinning as a weaker fallback.
            startLockTaskSafely()
            return
        }

        dpm.setLockTaskPackages(admin, arrayOf(packageName))

        // Make this the persistent HOME so Home button stays in-app.
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
            // Don't let the lock screen / keyguard interrupt the kiosk.
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
        } catch (_: Exception) {
            // Screen pinning may require user confirmation when not
            // device owner — ignore; the app-level fencing still holds.
        }
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
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersive()
    }

    // Back navigates WebView history; it can never finish the activity
    // (which would expose the launcher).
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        // else: swallow — do NOT call super (would exit the kiosk).
    }

    // Eat hardware keys that could disrupt the kiosk.
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_HOME,
            KeyEvent.KEYCODE_APP_SWITCH,
            KeyEvent.KEYCODE_MENU -> true
            else -> super.onKeyDown(keyCode, event)
        }
    }

    /** Small helper mirroring android.content.ComponentName for the
     *  persistent-preferred-activity registration. */
    @Suppress("FunctionName")
    private fun ComponentNameOf(ctx: Context, cls: Class<out Activity>) =
        android.content.ComponentName(ctx.packageName, cls.name)

    override fun onDestroy() {
        // Defensive: if the OS ever tears us down, drop the WebView
        // cleanly so a relaunch (HOME role / BootReceiver) is clean.
        try {
            webView.stopLoading()
            webView.destroy()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    @Suppress("unused")
    private fun hasInternetPermission(): Boolean =
        checkSelfPermission(android.Manifest.permission.INTERNET) ==
            PackageManager.PERMISSION_GRANTED
}
