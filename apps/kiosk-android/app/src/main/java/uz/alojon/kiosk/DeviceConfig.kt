package uz.alojon.kiosk

import android.content.Context

/**
 * Per-device MDM config: the backend base URL and the per-device enrollment
 * token (created by the admin in the superadmin panel and entered/scanned
 * once on the tablet). Stored in SharedPreferences.
 */
object DeviceConfig {
    private const val PREFS = "device_mdm"
    private const val KEY_BASE_URL = "base_url"
    private const val KEY_TOKEN = "enrollment_token"

    /** Default backend (same host the WebView loads, /api is stripped by nginx). */
    const val DEFAULT_BASE_URL = "https://alojon.uz/api"

    fun baseUrl(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL

    fun token(ctx: Context): String? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TOKEN, null)

    fun isConfigured(ctx: Context): Boolean = !token(ctx).isNullOrBlank()

    fun save(ctx: Context, token: String, baseUrl: String?) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_TOKEN, token.trim())
            .putString(
                KEY_BASE_URL,
                if (baseUrl.isNullOrBlank()) DEFAULT_BASE_URL else baseUrl.trim(),
            )
            .apply()
    }

    fun clear(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(KEY_TOKEN).apply()
    }
}
