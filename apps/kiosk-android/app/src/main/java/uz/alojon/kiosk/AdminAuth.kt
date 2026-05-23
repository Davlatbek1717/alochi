package uz.alojon.kiosk

import android.content.Context
import java.security.MessageDigest
import java.util.UUID

object AdminAuth {

    private const val PREFS = "kiosk_admin"
    private const val KEY_HASH = "pw_hash"
    private const val KEY_SALT = "pw_salt"

    fun isPasswordSet(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_HASH, null) != null
    }

    fun setPassword(context: Context, password: String) {
        val salt = UUID.randomUUID().toString()
        val hash = sha256("$salt:$password")
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_HASH, hash)
            .putString(KEY_SALT, salt)
            .apply()
    }

    fun checkPassword(context: Context, input: String): Boolean {
        // 1) Per-device local password (offline, set on this tablet).
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val storedHash = prefs.getString(KEY_HASH, null)
        if (storedHash != null) {
            val salt = prefs.getString(KEY_SALT, "") ?: ""
            if (sha256("$salt:$input") == storedHash) return true
        }
        // 2) Central org-wide password (#19), pushed via heartbeat and cached.
        // Same salted SHA-256 scheme as the server. Additive — never weakens
        // the local check, just lets one org password unlock any tablet.
        val cSalt = DeviceConfig.centralAdminSalt(context)
        val cHash = DeviceConfig.centralAdminHash(context)
        if (!cSalt.isNullOrBlank() && !cHash.isNullOrBlank()) {
            if (sha256("$cSalt:$input") == cHash) return true
        }
        return false
    }

    /** True when either a local or a central admin password is available. */
    fun isAnyPasswordSet(context: Context): Boolean =
        isPasswordSet(context) || !DeviceConfig.centralAdminHash(context).isNullOrBlank()

    private fun sha256(data: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(data.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
