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
    private const val KEY_ADMIN_SALT = "central_admin_salt"
    private const val KEY_ADMIN_HASH = "central_admin_hash"

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

    // ── Central kiosk admin password (#19) ────────────────────────────────────
    // Cached salt+hash (never the plaintext) delivered via the heartbeat, so
    // the admin gesture can be unlocked by the org-wide password offline.

    fun saveCentralAdmin(ctx: Context, salt: String?, hash: String?) {
        val e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        if (salt.isNullOrBlank() || hash.isNullOrBlank()) {
            e.remove(KEY_ADMIN_SALT).remove(KEY_ADMIN_HASH)
        } else {
            e.putString(KEY_ADMIN_SALT, salt).putString(KEY_ADMIN_HASH, hash)
        }
        e.apply()
    }

    fun centralAdminSalt(ctx: Context): String? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ADMIN_SALT, null)

    fun centralAdminHash(ctx: Context): String? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ADMIN_HASH, null)
}
